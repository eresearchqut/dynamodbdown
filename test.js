const { DynamoDBClient, CreateTableCommand } = require('@aws-sdk/client-dynamodb')
const suite = require('abstract-leveldown/test')
const test = require('tape')
const dynalite = require('dynalite')
const crypto = require('crypto')

const dynaliteServer = dynalite({ createTableMs: 0 })
const dynamoDBClient = new DynamoDBClient({
  endpoint: 'http://localhost:4567',
  region: 'local'
})

test('open dynalite', async function (assert) {
  assert.doesNotThrow(() => dynaliteServer.listen(4567, function (err) {
    if (err) {
      assert.comment('Failed to open dynalite')
      throw err
    }
    assert.end()
  }))
})

test('create table', async function (assert) {
  await dynamoDBClient.send(new CreateTableCommand({
    TableName: 'dynamodb-down',
    KeySchema: [{ AttributeName: 'hashKey', KeyType: 'HASH' }, { AttributeName: 'rangeKey', KeyType: 'RANGE' }],
    AttributeDefinitions: [
      { AttributeName: 'hashKey', AttributeType: 'S' },
      { AttributeName: 'rangeKey', AttributeType: 'S' }
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 1,
      WriteCapacityUnits: 1
    }
  })).then(() => assert.end()).catch(error => console.log(error))
})

// Dynamodb doesn't support the isolation level required by levelup, we pass a random partition (hashKey)
// to cover off the factory tests and also test storing different dbs in the same table,
const randomPartition = () => crypto.randomBytes(8).toString('hex')
const DynamoDBDOWN = require('./dynamodbdown')
const testCommon = suite.common({
  test: test,
  factory: () => new DynamoDBDOWN(dynamoDBClient, 'dynamodb-down', randomPartition()),

  // Opt-in to new clear() tests
  clear: true,

  // Opt-out of unsupported features
  createIfMissing: false,
  errorIfExists: false,
  encodings: true,
  snapshots: false
})

suite(testCommon)

test('close dynalite', function (assert) {
  dynaliteServer.close()
  assert.end()
})
