import { S3 } from 'aws-sdk';

module.exports = async (s3: S3, bucketName: string): Promise<boolean> => {
    try {
        await s3
        .headBucket({
            Bucket: bucketName
        })
        .promise();

        return true;
    } catch (error) {
        return false;
    }
}
