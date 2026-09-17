import * as path from 'path';
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import { TABLE_NAMES, INDEX_NAMES } from '@meditory/shared';

export class MeditoryStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // =========================================================================
    // 1. Amazon DynamoDB Multi-Table Schema (100% Free-Tier & On-Demand)
    // =========================================================================

    // 1.1 Health Facilities Table (Clinic directory, location, contact)
    const facilitiesTable = new dynamodb.Table(this, 'FacilitiesTable', {
      tableName: TABLE_NAMES.FACILITIES,
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 1.2 Healthcare Workers Table (Staff credentials, facility tenancy)
    const workersTable = new dynamodb.Table(this, 'WorkersTable', {
      tableName: TABLE_NAMES.WORKERS,
      partitionKey: { name: 'email', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // 1.3 Clinic Shelf Inventory Table (Primary shelf items + Inter-clinic lookup GSI)
    const inventoryTable = new dynamodb.Table(this, 'InventoryTable', {
      tableName: TABLE_NAMES.INVENTORY,
      partitionKey: { name: 'facilityId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'drugId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Global Secondary Index for emergency medicine discovery across clinics
    inventoryTable.addGlobalSecondaryIndex({
      indexName: INDEX_NAMES.INVENTORY_BY_DRUG,
      partitionKey: { name: 'drugId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // 1.4 Clinic Audit Logs Table (Append-only transaction trail)
    const auditLogsTable = new dynamodb.Table(this, 'AuditLogsTable', {
      tableName: TABLE_NAMES.AUDIT_LOGS,
      partitionKey: { name: 'facilityId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // =========================================================================
    // 2. Common Lambda Function Environment & Bundling Configuration
    // =========================================================================
    const commonLambdaProps: Partial<nodejs.NodejsFunctionProps> = {
      runtime: lambda.Runtime.NODEJS_20_X,
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      environment: {
        NODE_ENV: 'production',
        JWT_SECRET: process.env.JWT_SECRET || 'meditory_production_secret_key_bharat_2026',
        TABLE_FACILITIES: facilitiesTable.tableName,
        TABLE_WORKERS: workersTable.tableName,
        TABLE_INVENTORY: inventoryTable.tableName,
        TABLE_AUDIT_LOGS: auditLogsTable.tableName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
        target: 'node20',
        externalModules: ['@aws-sdk/*'],
      },
    };

    const handlersDir = path.join(__dirname, '../src/handlers');

    // =========================================================================
    // 3. Serverless Lambda Handlers (Business Logic)
    // =========================================================================

    // 3.1 Authentication Handlers
    const authFn = new nodejs.NodejsFunction(this, 'AuthHandler', {
      ...commonLambdaProps,
      entry: path.join(handlersDir, 'auth.ts'),
      handler: 'loginHandler',
      description: 'Meditory Staff Login and Logout handler',
    });

    const meFn = new nodejs.NodejsFunction(this, 'MeHandler', {
      ...commonLambdaProps,
      entry: path.join(handlersDir, 'auth.ts'),
      handler: 'meHandler',
      description: 'Meditory Staff Session verification handler',
    });

    // 3.2 Inventory Query Handler
    const inventoryFn = new nodejs.NodejsFunction(this, 'InventoryHandler', {
      ...commonLambdaProps,
      entry: path.join(handlersDir, 'inventory.ts'),
      handler: 'inventoryHandler',
      description: 'Meditory Clinic Inventory with IPHS priority sorting',
    });

    // 3.3 Dispense Handler (Atomic ConditionExpression: qty >= :dispenseQty)
    const dispenseFn = new nodejs.NodejsFunction(this, 'DispenseHandler', {
      ...commonLambdaProps,
      entry: path.join(handlersDir, 'dispense.ts'),
      handler: 'dispenseHandler',
      description: 'Meditory 1-tap and custom quantity dispensing with CloudWatch EMF metrics',
    });

    // 3.4 Restock Handler (Atomic increment & status calculation)
    const restockFn = new nodejs.NodejsFunction(this, 'RestockHandler', {
      ...commonLambdaProps,
      entry: path.join(handlersDir, 'restock.ts'),
      handler: 'restockHandler',
      description: 'Meditory Restock handler with audit log trail',
    });

    // 3.5 Inter-Clinic Referral Locator Handler
    const locatorFn = new nodejs.NodejsFunction(this, 'LocatorHandler', {
      ...commonLambdaProps,
      entry: path.join(handlersDir, 'locator.ts'),
      handler: 'locatorHandler',
      description: 'Meditory Inter-Clinic Emergency Referral Locator',
    });

    // 3.6 Audit Trail Handler
    const auditFn = new nodejs.NodejsFunction(this, 'AuditHandler', {
      ...commonLambdaProps,
      entry: path.join(handlersDir, 'audit.ts'),
      handler: 'auditHandler',
      description: 'Meditory Clinic Audit Trail query handler',
    });

    // =========================================================================
    // 4. Least-Privilege IAM Grants (Zero Security Over-Privileging)
    // =========================================================================
    workersTable.grantReadData(authFn);
    facilitiesTable.grantReadData(authFn);

    workersTable.grantReadData(meFn);

    inventoryTable.grantReadData(inventoryFn);
    facilitiesTable.grantReadData(inventoryFn);

    inventoryTable.grantReadWriteData(dispenseFn);
    auditLogsTable.grantWriteData(dispenseFn);

    inventoryTable.grantReadWriteData(restockFn);
    auditLogsTable.grantWriteData(restockFn);

    inventoryTable.grantReadData(locatorFn);
    facilitiesTable.grantReadData(locatorFn);

    auditLogsTable.grantReadData(auditFn);

    // =========================================================================
    // 5. Amazon API Gateway HTTP API (v2) with CORS & Cookie Support
    // =========================================================================
    const httpApi = new apigwv2.HttpApi(this, 'MeditoryHttpApi', {
      apiName: 'Meditory-API',
      description: 'Meditory Clinic-to-Clinic Serverless HTTP API',
      corsPreflight: {
        allowOrigins: [
          'http://localhost:3000',
          'http://localhost:3001',
          'https://*.vercel.app',
          'https://*.amplifyapp.com',
        ],
        allowMethods: [
          apigwv2.CorsHttpMethod.GET,
          apigwv2.CorsHttpMethod.POST,
          apigwv2.CorsHttpMethod.PUT,
          apigwv2.CorsHttpMethod.DELETE,
          apigwv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization', 'Cookie', 'X-Requested-With'],
        allowCredentials: true,
      },
    });

    // Integrations
    const authIntegration = new HttpLambdaIntegration('AuthIntegration', authFn);
    const meIntegration = new HttpLambdaIntegration('MeIntegration', meFn);
    const inventoryIntegration = new HttpLambdaIntegration('InventoryIntegration', inventoryFn);
    const dispenseIntegration = new HttpLambdaIntegration('DispenseIntegration', dispenseFn);
    const restockIntegration = new HttpLambdaIntegration('RestockIntegration', restockFn);
    const locatorIntegration = new HttpLambdaIntegration('LocatorIntegration', locatorFn);
    const auditIntegration = new HttpLambdaIntegration('AuditIntegration', auditFn);

    // Route Definitions (supporting both standard and /api prefix paths)
    const routeMappings = [
      { path: '/auth/login', method: apigwv2.HttpMethod.POST, integration: authIntegration },
      { path: '/auth/me', method: apigwv2.HttpMethod.GET, integration: meIntegration },
      { path: '/auth/logout', method: apigwv2.HttpMethod.POST, integration: authIntegration },
      { path: '/clinic/inventory', method: apigwv2.HttpMethod.GET, integration: inventoryIntegration },
      { path: '/clinic/dispense', method: apigwv2.HttpMethod.POST, integration: dispenseIntegration },
      { path: '/clinic/restock', method: apigwv2.HttpMethod.POST, integration: restockIntegration },
      { path: '/clinic/audit', method: apigwv2.HttpMethod.GET, integration: auditIntegration },
      { path: '/network/stock-locator', method: apigwv2.HttpMethod.GET, integration: locatorIntegration },
    ];

    for (const r of routeMappings) {
      httpApi.addRoutes({
        path: r.path,
        methods: [r.method],
        integration: r.integration,
      });
      httpApi.addRoutes({
        path: `/api${r.path}`,
        methods: [r.method],
        integration: r.integration,
      });
    }

    // =========================================================================
    // 6. Amazon CloudWatch Metric Alarms (Emergency Medicine Alerts)
    // =========================================================================
    const emergencyStockMetric = new cloudwatch.Metric({
      namespace: 'Meditory/Clinics',
      metricName: 'StockLevel',
      dimensionsMap: {
        DrugId: 'DRUG-ASV-01',
      },
      statistic: 'Minimum',
      period: cdk.Duration.minutes(1),
    });

    new cloudwatch.Alarm(this, 'EmergencyMedicineDepletedAlarm', {
      alarmName: 'Meditory-AntiSnakeVenom-Depleted',
      alarmDescription: 'Alerts when Anti-Snake Venom stock reaches 0 in any monitored facility',
      metric: emergencyStockMetric,
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // =========================================================================
    // 7. Stack CloudFormation Outputs
    // =========================================================================
    new cdk.CfnOutput(this, 'ApiEndpointUrl', {
      value: httpApi.url ?? '',
      description: 'Amazon API Gateway HTTP API Base URL',
      exportName: 'MeditoryApiEndpointUrl',
    });

    new cdk.CfnOutput(this, 'FacilitiesTableNameOutput', {
      value: facilitiesTable.tableName,
      description: 'DynamoDB Facilities Table Name',
    });

    new cdk.CfnOutput(this, 'InventoryTableNameOutput', {
      value: inventoryTable.tableName,
      description: 'DynamoDB Inventory Table Name',
    });
  }
}
