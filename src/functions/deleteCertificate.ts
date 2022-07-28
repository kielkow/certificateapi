import { APIGatewayProxyHandler } from "aws-lambda"
import { unlinkSync } from "fs";
import { document } from '../utils/dynamodbClient'
import { S3 } from 'aws-sdk';

import { checkIfBucketExists } from '../utils/checkIfBucketExists';

export const handler: APIGatewayProxyHandler = async (event) => {
    try {
        const { id } = event.pathParameters;

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
        }

        await document
            .delete({
                TableName: 'users_certificate',
                Key: {
                    id
                }
            })
            .promise();

        if (process.env.IS_OFFLINE) {
            unlinkSync('./certificate.pdf')
        }
        else {
            const s3 = new S3();

            const bucketExists = await checkIfBucketExists(s3, 'certificateserverlessnodejs');
            if (!bucketExists) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        message: 'Bucket certificateserverlessnodejs not exists',
                    })
                }
            }

            await s3
                .deleteObject({
                    Bucket: 'certificateserverlessnodejs',
                    Key: `${id}.pdf`,
                })
                .promise();
        }

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: 'certificate deleted with success'
            })
        }
    }
    catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({
                message: error.message || error,
                stack: error.stack || ''
            })
        }
    }
}
