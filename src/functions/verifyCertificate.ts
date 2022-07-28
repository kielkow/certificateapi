import { APIGatewayProxyHandler } from "aws-lambda";
import { document } from '../utils/dynamodbClient'

interface IUserCertificate {
    id: string;
    name: string;
    created_at: string;
    grade: string;
}

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

        const userCertificate = response.Items[0] as IUserCertificate;

        if (!userCertificate) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: 'Invalid certificate',
                })
            }
        }

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: 'Certificate valid',
                name: userCertificate.name,
                url: `https://certificateserverlessnodejs.s3.amazonaws.com/${id}.pdf`
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
