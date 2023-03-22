"use strict";
const AWS = require("aws-sdk");
const http = require("http");

const ec2 = new AWS.EC2();

exports.handler = async (event) => {
  const instances = await GetEc2s(process.env.project);
  const expectedClusterSize = instances.length;
  //console.log("Instances Length: ", expectedClusterSize);
  let logData = {
    expectedClusterSize,
    instances: []
  };
  let success = true;

  for (const inst of instances) {
    // console.log(`Checking Hazelcast status for: ${JSON.stringify(inst)}`);
    let resData;

    resData = await GetHazelcastStatus(inst).catch(error => resData = "Hazelcast::ClusterSize=OFFLINE");
    //console.log(`Response Data: ${resData}`);

    for (const hazelStatus of resData.split("\n")) {
      const keyValue = hazelStatus.split("=");

      if (keyValue[0] === "Hazelcast::ClusterSize") {
        //console.log(`Hazelcast Status: ${hazelStatus}`);
        inst.status = hazelStatus;
        if (expectedClusterSize.toString() === keyValue[1].toString()) {
          // Values match, we're all good
          inst.result = "Expected match";
        } else {
          // Registered clusters don't match expected clusters
          //console.log("Big bad thing here");
          inst.result = "Values do not match.";
          success = false;
          //throw new Error(`Instance ${inst.ip} reports ${keyValue[1]}, expected ${expectedClusterSize}`);
        }

        //console.log(`${JSON.stringify(logData)}`);
      }
    }
    logData.instances.push(inst);
  }
  console.log(`${JSON.stringify(logData)}`);
  if (!success) {
    throw new HazelcastError(expectedClusterSize, logData);
  }
};

async function GetHazelcastStatus(instance) {
  return new Promise((resolve, reject) => {

    const options = {
      hostname: instance.ip,
      port: 8995,
      path: "/hazelcast/health",
      method: "GET"
    };

    let responseData = [];

    const req = http.get(options, (res) => {
      //console.log("statusCode: ", res.statusCode);

      res.setEncoding("utf8");

      res.on("data", (d) => {
        responseData.push(d);
      });
      res.on("end", () => {
        //console.log("Response: ", responseData.join());
        resolve(responseData.join());
      });
    });

    req.on("error", (e) => {
      //console.error("Error: ", e);
      resolve("Hazelcast::ClusterSize=OFFLINE");
    });

    req.end();
  });
}

async function GetEc2s(projectName) {
  return new Promise((resolve, reject) => {
    let toReturn = [];

    const params = {
      Filters: [{
        Name: "tag:Hazelcast",
        Values: [
          projectName
        ]
      }]
    };

    ec2.describeInstances(params, function(err, data) {
      if (err) {
        console.error("EC2 Error: ", err);
        reject(err);
      } else {
        for (const res of data.Reservations) {
          for (const instance of res.Instances) {
            if (instance.State.Name === "running") {
              let inst = {
                name: "",
                ip: "",
              };

              for (const tag of instance.Tags) {
                if (tag.Key === "Name") {
                  inst.name = tag.Value;
                  break;
                }
              }

              for (const network of instance.NetworkInterfaces) {
                inst.ip = network.PrivateIpAddress;
                break;
              }
              toReturn.push(inst);
            }
          }
        }

        resolve(toReturn);
      }
    });
  });
}

class HazelcastError extends Error {
  constructor (expectedInstanceCount, instanceDetails) {
    super(`Expected ${expectedInstanceCount}, instance results: ${JSON.stringify(instanceDetails)}`);

    this.name = this.constructor.name;

    Error.captureStackTrace(this, this.constructor);
  }
}