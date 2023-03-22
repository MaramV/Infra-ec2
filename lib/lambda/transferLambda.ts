import AWS from 'aws-sdk';
import { Context } from 'aws-lambda'

export const lambdaHandler = async (event: any, context: Context): Promise<void> => {
  const region = process.env.AWS_REGION;
  const services = JSON.parse(process.env.service!);
  let client = new AWS.S3({ region: region, apiVersion: '2006-03-01'});
  console.log(client);
  console.log(`Starting execution in ${region} in ${process.env.project}`);
  console.log('Files to transfer:');
  await Promise.all(services.map(async (service: string ) => {
    console.log(service);
    try {
      let result = await client.copyObject({
        Bucket: `ecom-pipeline/${process.env.project}`,
        CopySource: `/ecom-pipeline/prod/tomcat/${service}.zip`,
        Key: `${service}.zip`,
      }).promise();
      console.log(result);
    } catch (err) {
      console.log(err)
    }
  }));
}