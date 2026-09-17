#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MeditoryStack } from '../lib/meditory-stack';

const app = new cdk.App();
new MeditoryStack(app, 'MeditoryStack', {
  description: 'Meditory — Clinic-to-Clinic Serverless Platform Stack',
});
