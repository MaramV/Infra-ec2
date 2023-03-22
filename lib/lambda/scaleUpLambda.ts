import AWS from 'aws-sdk';
import { TomcatServices, TomcatService } from '../model/TomcatServices';
import { ApacheServices, ApacheService } from '../model/ApacheServices';

export const lambdaHandler = async (event: any, context: any): Promise<void> => {
  // let tomcatServices: TomcatServices = require("../service-parameters/tomcat.json");
  let tomcatServices: TomcatServices = require("../../service-parameters/tomcat.json");
  const apacheServices: ApacheServices = require("../../service-parameters/apache.json");
  var autoscaling = new AWS.AutoScaling();
  let promises: Promise<any>[] = [];

  tomcatServices.services.forEach(function (service: TomcatService) {
    var params = {
      AutoScalingGroupName: context.functionName.replace("scaleUp","") + service.name.toString(), 
      MaxSize: 4, 
      MinSize: 1, 
      DesiredCapacity: 1,
      NewInstancesProtectedFromScaleIn: false
    };
    promises.push(autoscaling.updateAutoScalingGroup(params).promise());
  });
  apacheServices.services.forEach(function (service: ApacheService) {
    var params = {
      AutoScalingGroupName: context.functionName.replace("scaleUp","") + service.name.toString(), 
      MaxSize: 4, 
      MinSize: 1, 
      DesiredCapacity: 1,
      NewInstancesProtectedFromScaleIn: false
     };
     promises.push(autoscaling.updateAutoScalingGroup(params).promise());
  });
  await Promise.all(promises);
  //  console.log("response: ", response);

}