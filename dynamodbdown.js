'use strict'
const inherits = require('util').inherits
const AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN

const {
  GetItemCommand,
  PutItemCommand,
  DeleteItemCommand,
  BatchWriteItemCommand
} = require('@aws-sdk/client-dynamodb')

const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')
const MAX_BATCH_SIZE = 25
const DynamoDBIterator = require('./iterator')

function DynamoDBDOWN (dynamoDBClient, tableName, partition) {
  if (!(this instanceof DynamoDBDOWN)) {
    return new DynamoDBDOWN(dynamoDBClient, tableName, partition)
  }
  AbstractLevelDOWN.call(this)
  this.dynamoDBClient = dynamoDBClient
  this.tableName = tableName
  this.partition = partition
}

inherits(DynamoDBDOWN, AbstractLevelDOWN)

DynamoDBDOWN.prototype._open = function (options, callback) {
  callback(null, this)
}

DynamoDBDOWN.prototype._put = function (key, value, options, callback) {
  try {
    this.dynamoDBClient
      .send(new PutItemCommand({
        TableName: this.tableName,
        Item: marshall({
          hashKey: this.partition,
          rangeKey: key.toString(),
          value: value
        })
      }))
      .then(() => process.nextTick(callback))
      .catch(error => process.nextTick(callback, error))
  } catch (marshallError) {
    process.nextTick(callback, marshallError)
  }
}

DynamoDBDOWN.prototype._get = function (key, options, callback) {
  return this.dynamoDBClient.send(
    new GetItemCommand({
      TableName: this.tableName,
      Key: marshall({
        hashKey: this.partition,
        rangeKey: key.toString()
      })
    }))
    .then(data => data.Item && unmarshall(data.Item))
    .then(item => item && item.value)
    .then(value => value != null
      ? process.nextTick(callback, null, value)
      : process.nextTick(callback, new Error('NotFound')))
}

DynamoDBDOWN.prototype._del = function (key, options, callback) {
  this.dynamoDBClient
    .send(new DeleteItemCommand({
      TableName: this.tableName,
      Key: marshall({
        hashKey: this.partition,
        rangeKey: key.toString()
      })
    }))
    .then(() => process.nextTick(callback))
    .catch(error => process.nextTick(callback, error))
}

DynamoDBDOWN.prototype._batch = function (array, options, callback) {
  const operationKeys = {}
  const operations = []

  array.forEach((item) => {
    // Dynamodb will reject duplicates in the batch
    // Remove earlier instances of the item if the operation is of the same type
    if (operationKeys[item.key]) {
      const duplicateIndex = operations.findIndex(command => {
        return (command.DeleteRequest && command.DeleteRequest.Key.rangeKey.S === item.key) ||
          (command.PutRequest && command.PutRequest.Item.rangeKey.S === item.key)
      })
      if (duplicateIndex !== -1) {
        operations.splice(duplicateIndex, 1)
      }
    }

    const operation = item.type === 'del' ? {
      DeleteRequest: {
        Key: marshall({
          hashKey: this.partition,
          rangeKey: item.key.toString()
        })
      }
    } : {
      PutRequest: {
        Item: marshall({
          hashKey: this.partition,
          rangeKey: item.key.toString(),
          value: item.value
        })
      }
    }

    operationKeys[item.key] = true
    operations.push(operation)
  })

  const params = { RequestItems: {} }
  const loop = (error, previousResult) => {
    if (error) {
      callback(error)
      return
    }

    const requestItems = []

    //  If any requested operations fail because the table's provisioned throughput is exceeded or an
    //  internal processing failure occurs, the failed operations are returned in the UnprocessedItems
    //  response parameter.
    if (previousResult && previousResult.UnprocessedItems && previousResult.UnprocessedItems[this.tableName]) {
      requestItems.push.apply(requestItems, previousResult.UnprocessedItems[this.tableName])
    }

    requestItems.push.apply(requestItems, operations.splice(0, MAX_BATCH_SIZE - requestItems.length))

    if (requestItems.length === 0) {
      callback()
    } else {
      params.RequestItems[this.tableName] = requestItems
      this.dynamoDBClient
        .send(new BatchWriteItemCommand(params)).then(result => loop(null, result))
        .catch(error => loop(error))
    }
  }

  loop()
}

DynamoDBDOWN.prototype._iterator = function (options) {
  return new DynamoDBIterator(this, options)
}

DynamoDBDOWN.destroy = function (name, callback) {
  callback()
}

module.exports = DynamoDBDOWN
