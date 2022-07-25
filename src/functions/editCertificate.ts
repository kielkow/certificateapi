import { APIGatewayProxyHandler } from "aws-lambda"
import { readFileSync } from "fs";
import { join } from "path";
import { document } from '../utils/dynamodbClient'
import * as handlebars from 'handlebars';
import dayjs from "dayjs";
import Chromium from "chrome-aws-lambda";
import { S3 } from 'aws-sdk';

import { checkIfBucketExists } from '../utils/checkIfBucketExists';

interface ICreateCertificate {
    id: string;
    name: string;
    grade: string;
}

interface ITemplate {
    id: string;
    name: string;
    grade: string;
    medal: string;
    date: string;
}

const compileTemplate = async (data: ITemplate) => {
    const filePath = join(process.cwd(), "src", "templates", "certificate.hbs");

    const html = readFileSync(filePath, "utf-8");

    return handlebars.compile(html)(data)
}

export const handler: APIGatewayProxyHandler = async (event) => {
    const { id } = event.pathParameters;
    const { name, grade } = JSON.parse(event.body) as ICreateCertificate;

    const response = await document
        .query({
            TableName: 'users_certificate',
            KeyConditionExpression: "id = :id",
            ExpressionAttributeValues: {
                ":id": id
            }
        })
        .promise();

    const userAlreadyExists = response.Items[0];

    if (!userAlreadyExists) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                message: 'User certificate not found',
            })
        }
    } else {
        await document
        .put({
            TableName: 'users_certificate',
            Item: {
                id,
                name,
                grade,
                created_at: new Date().getTime(),
            }
        })
        .promise();
    }

    const medalPath = join(process.cwd(), "src", "templates", "selo.png");
    const medal = readFileSync(medalPath, "base64");

    const data: ITemplate = {
        id,
        name,
        grade,
        medal,
        date: dayjs().format("DD/MM/YYYY")
    }

    const content = await compileTemplate(data);

    const browser = await Chromium.puppeteer.launch({
        args: Chromium.args,
        defaultViewport: Chromium.defaultViewport,
        executablePath: await Chromium.executablePath,
    });

    const page = await browser.newPage();

    await page.setContent(content);

    const pdf = await page.pdf({
        format: 'a4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
        path: process.env.IS_OFFLINE ? './certificate.pdf' : null
    });

    await browser.close();

    const s3 = new S3();

    const bucketExists = await checkIfBucketExists(s3, 'certificateserverlessnodejs');
    if (!bucketExists) {
        await s3
        .createBucket({
            Bucket: 'certificateserverlessnodejs'
        })
        .promise();
    }

    await s3
        .putObject({
            Bucket: 'certificateserverlessnodejs',
            Key: `${id}.pdf`,
            ACL: 'public-read',
            Body: pdf,
            ContentType: 'application/pdf'
        })
        .promise();

    return {
        statusCode: 201,
        body: JSON.stringify({
            message: 'certificate updated with success',
            url: `https://certificateserverlessnodejs.s3.amazonaws.com/${id}.pdf`
        })
    }
}
