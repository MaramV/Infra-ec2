#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { OtcInfraEc2Stack } from '../lib/otc-infra-ec2-stack';
import { OtcInfraLambdaStack } from '../lib/otc-infra-lambda-stack';
import parameters from "../parameters.json";
import { TomcatServices, TomcatService } from '../lib/model/TomcatServices';
import { ApacheServices } from '../lib/model/ApacheServices';
import { AllParams } from '../lib/model/AllParams';

const allParams: AllParams = require("../parameters.json");
let tomcatServices: TomcatServices = require("../service-parameters/tomcat.json");
const apacheServices: ApacheServices = require("../service-parameters/apache.json");
const app = new cdk.App();
let projectName: string = "ecommrearch";
const project = app.node.tryGetContext('projectName');
// const environment = app.node.tryGetContext("accountEnv")
if (project && project !== ""){
  projectName = project;
}

// Set the default EC2 Instance Type if necessary
tomcatServices = TomcatServices.SetDefaults(tomcatServices);

const deployLambda = app.node.tryGetContext('deployLambda');
if (deployLambda !== 'true') {
  const stack = new OtcInfraEc2Stack(app, 'OtcInfra' + projectName + 'Stack',
    projectName, allParams, apacheServices, tomcatServices, {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION
    }
  });
  // Add Global Tags to resources in the stack
  cdk.Tags.of(stack).add("map-migrated", allParams.globalTags.mapMigrated);
  cdk.Tags.of(stack).add("Budget Code", allParams.globalTags.budgetCode);
  cdk.Tags.of(stack).add("Cost Center", allParams.globalTags.costCenter);
  cdk.Tags.of(stack).add("Project", projectName);
} else {
  const stack = new OtcInfraLambdaStack(app, 'OtcInfra' + projectName + 'LambdaStack',
    projectName, allParams, apacheServices, tomcatServices, {
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT,
      region: process.env.CDK_DEFAULT_REGION
    }
  });
  // Add Global Tags to resources in the stack
  cdk.Tags.of(stack).add("map-migrated", allParams.globalTags.mapMigrated);
  cdk.Tags.of(stack).add("Budget Code", allParams.globalTags.budgetCode);
  cdk.Tags.of(stack).add("Cost Center", allParams.globalTags.costCenter);
  cdk.Tags.of(stack).add("Project", projectName);
}


