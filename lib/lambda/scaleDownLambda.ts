import AWS from 'aws-sdk';
import { TomcatServices, TomcatService } from '../model/TomcatServices';
import { ApacheServices, ApacheService } from '../model/ApacheServices';

export const lambdaHandler = async (event: any, context: any): Promise<void> => {
  let tomcatServices: TomcatServices = require("../../service-parameters/tomcat.json");
  const apacheServices: ApacheServices = require("../../service-parameters/apache.json");
  tomcatServices = TomcatServices.SetDefaults(tomcatServices);
  var autoscaling = new AWS.AutoScaling();
  let promises: Promise<any>[] = [];

  tomcatServices.services.forEach(function (service: TomcatService) {
    var params = {
      AutoScalingGroupName: context.functionName.replace("scaleDown","") + service.name.toString(), 
      MaxSize: 0, 
      MinSize: 0, 
      DesiredCapacity: 0,
      NewInstancesProtectedFromScaleIn: false
     };
     promises.push(autoscaling.updateAutoScalingGroup(params).promise());
  });
  apacheServices.services.forEach(function (service: ApacheService) {
    var params = {
      AutoScalingGroupName: context.functionName.replace("scaleDown","") + service.name.toString(), 
      MaxSize: 0, 
      MinSize: 0, 
      DesiredCapacity: 0,
      NewInstancesProtectedFromScaleIn: false
     };
     promises.push(autoscaling.updateAutoScalingGroup(params).promise());
  });
  await Promise.all(promises);
  //  console.log("response: ", response);
}