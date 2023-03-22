# Welcome to your CDK TypeScript project

This is a blank project for CDK development with TypeScript.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template

### Commands to synth, diff, and deploy in the various environments

1. `npm install` : Will install any packages needed for the project, based on the package.json file
2. `cdk context --clear` : Run this prior to a synth, diff, or deploy to make sure any cached content in your cdk.context.json file is cleared out

#### For QA AWS Environemnt
The AWS QA Environment will support multiple QA deployments.  This are differentiated by the project name attribute.

Examples below for deploying to QA for a project named `ecommrearch` and how it differs for a project named `megarelease`.

##### For QA AWS Environment, ecommrearch project Deployment
```shell
# Synth, Diff, Deploy, and Destroy for the ScaleUp/ScaleDown Lambda
cdk synth --context accountEnv=otc-qa-vpc1 -c projectName=ecommrearch -c deployLambda=true --profile ortc-ecom-qa

cdk diff --context accountEnv=otc-qa-vpc1 -c projectName=ecommrearch -c deployLambda=true --profile ortc-ecom-qa

cdk deploy --context accountEnv=otc-qa-vpc1 -c projectName=ecommrearch -c deployLambda=true --profile ortc-ecom-qa

cdk destroy --context accountEnv=otc-qa-vpc1 -c projectName=ecommrearch -c deployLambda=true --profile ortc-ecom-qa

# Synth, Diff, Deploy, and Destroy for the Compute Infra
cdk synth --context accountEnv=otc-qa-vpc1 -c projectName=ecommrearch --profile ortc-ecom-qa

cdk diff --context accountEnv=otc-qa-vpc1 -c projectName=ecommrearch --profile ortc-ecom-qa

cdk deploy --context accountEnv=otc-qa-vpc1 -c projectName=ecommrearch --profile ortc-ecom-qa

cdk destroy --context accountEnv=otc-qa-vpc1 -c projectName=ecommrearch --profile ortc-ecom-qa
```

##### For QA AWS Environment, megarelease project Deployment
```shell
# Synth, Diff, Deploy, and Destroy for the ScaleUp/ScaleDown Lambda
cdk synth --context accountEnv=otc-qa-vpc1 -c projectName=megarelease -c deployLambda=true --profile ortc-ecom-qa

cdk diff --context accountEnv=otc-qa-vpc1 -c projectName=megarelease -c deployLambda=true --profile ortc-ecom-qa

cdk deploy --context accountEnv=otc-qa-vpc1 -c projectName=megarelease -c deployLambda=true --profile ortc-ecom-qa

cdk destroy --context accountEnv=otc-qa-vpc1 -c projectName=megarelease -c deployLambda=true --profile ortc-ecom-qa

# Synth, Diff, Deploy, and Destroy for the Compute Infra
cdk synth --context accountEnv=otc-qa-vpc1 -c projectName=megarelease --profile ortc-ecom-qa

cdk diff --context accountEnv=otc-qa-vpc1 -c projectName=megarelease --profile ortc-ecom-qa

cdk deploy --context accountEnv=otc-qa-vpc1 -c projectName=megarelease --profile ortc-ecom-qa

cdk destroy --context accountEnv=otc-qa-vpc1 -c projectName=megarelease --profile ortc-ecom-qa
```

#### For PreProd AWS Environment, on a preprod Project Deployment
```shell
# Synth, Diff, Deploy, and Destroy for the ScaleUp/ScaleDown Lambda
cdk synth --context accountEnv=otc-preprod -c deployLambda=true --profile ortc-ecom-preprod

cdk diff --context accountEnv=otc-preprod -c deployLambda=true --profile ortc-ecom-preprod

cdk deploy --context accountEnv=otc-preprod -c deployLambda=true --profile ortc-ecom-preprod

cdk destroy --context accountEnv=otc-preprod -c deployLambda=true --profile ortc-ecom-preprod

# Synth, Diff, Deploy, and Destroy for the Compute Infra
cdk synth --context accountEnv=otc-preprod --profile ortc-ecom-preprod

cdk diff --context accountEnv=otc-preprod --profile ortc-ecom-preprod

cdk deploy --context accountEnv=otc-preprod --profile ortc-ecom-preprod

cdk destroy --context accountEnv=otc-preprod --profile ortc-ecom-preprod
```

#### For Production AWS Environment

##### For ProdA VPC
```shell
# Synth, Diff, Deploy, and Destroy for the ScaleUp/ScaleDown Lambda
cdk synth --context accountEnv=otc-prodA -c projectName=proda -c deployLambda=true --profile ortc-ecom-prod

cdk diff --context accountEnv=otc-prodA -c projectName=proda -c deployLambda=true --profile ortc-ecom-prod

cdk deploy --context accountEnv=otc-prodA -c projectName=proda -c deployLambda=true --profile ortc-ecom-prod

cdk destroy --context accountEnv=otc-prodA -c projectName=proda -c deployLambda=true --profile ortc-ecom-prod

# Synth, Diff, Deploy, and Destroy for the Compute Infra
cdk synth --context accountEnv=otc-prodA -c projectName=proda --profile ortc-ecom-prod

cdk diff --context accountEnv=otc-prodA -c projectName=proda --profile ortc-ecom-prod

cdk deploy --context accountEnv=otc-prodA -c projectName=proda --profile ortc-ecom-prod

cdk destroy --context accountEnv=otc-prodA -c projectName=proda --profile ortc-ecom-prod
```

##### For ProdB VPC
```shell
# Synth, Diff, Deploy, and Destroy for the ScaleUp/ScaleDown Lambda
cdk synth --context accountEnv=otc-prodB -c projectName=prodb -c deployLambda=true --profile ortc-ecom-prod

cdk diff --context accountEnv=otc-prodB -c projectName=prodb -c deployLambda=true --profile ortc-ecom-prod

cdk deploy --context accountEnv=otc-prodB -c projectName=prodb -c deployLambda=true --profile ortc-ecom-prod

cdk destroy --context accountEnv=otc-prodB -c projectName=prodb -c deployLambda=true --profile ortc-ecom-prod

# Synth, Diff, Deploy, and Destroy for the Compute Infra
cdk synth --context accountEnv=otc-prodB -c projectName=prodb --profile ortc-ecom-prod

cdk diff --context accountEnv=otc-prodB -c projectName=prodb --profile ortc-ecom-prod

cdk deploy --context accountEnv=otc-prodB -c projectName=prodb --profile ortc-ecom-prod

cdk destroy --context accountEnv=otc-prodB -c projectName=prodb --profile ortc-ecom-prod
```
