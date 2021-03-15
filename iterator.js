'use strict'
const inherits = require('util').inherits
const through2 = require('through2')
const AbstractIterator = require('abstract-leveldown').AbstractIterator
const { QueryCommand } = require('@aws-sdk/client-dynamodb')
const { marshall, unmarshall } = require('@aws-sdk/util-dynamodb')

function DynamoDBIterator (db, options) {
  AbstractIterator.call(this, db)
  this.db = db
  this._results = this.createReadStream(options)
  this._results.once('end', () => {
    this._endEmitted = true
  })
}

inherits(DynamoDBIterator, AbstractIterator)

DynamoDBIterator.prototype._next = function (callback) {
  const onEnd = () => {
    this._results.removeListener('readable', onReadable)
    callback()
  }
  const onReadable = () => {
    this._results.removeListener('end', onEnd)
    this._next(callback)
  }
  const keyValue = this._results.read()
  if (this._endEmitted) {
    callback()
  } else if (keyValue === null) {
    this._results.once('readable', onReadable)
    this._results.once('end', onEnd)
  } else {
    callback(null,
      keyValue.key,
      keyValue.value)
  }
}

DynamoDBIterator.prototype.createReadStream = function (options) {
  let returnCount = 0
  if (options.limit === -1) {
    options.limit = Infinity
  }

  const isFinished = () => {
    return options.limit && returnCount > options.limit
  }

  const stream = through2.obj(function (item, enc, callback) {
    const output = {
      key: item.rangeKey,
      value: item.value
    }
    returnCount += 1
    if (!isFinished()) {
      this.push(output)
    }
    callback()
  })

  const onData = (err, results) => {
    if (err) {
      if (err.code === 'ResourceNotFoundException') {
        stream.end()
      } else {
        stream.emit('error', err)
      }
      return stream
    }
    results.Items.map(item => unmarshall(item)).forEach((item) => {
      let filtered = false
      if ((options.gt && !(item.rangeKey > options.gt)) ||
                (options.lt && !(item.rangeKey < options.lt))) {
        filtered = true
      }
      if (!filtered) {
        stream.write(item)
      }
    })

    options.ExclusiveStartKey = results.LastEvaluatedKey

    if (options.ExclusiveStartKey && !isFinished()) {
      this.getRange(options, onData)
    } else {
      stream.end()
    }
  }

  if (options.limit === 0) {
    stream.end()
  } else {
    this.getRange(options, onData)
  }

  return stream
}

DynamoDBIterator.prototype.getRange = function (options, callback) {
  if (options.gte) {
    if (options.reverse) {
      options.end = options.gte
    } else {
      options.start = options.gte
    }
  }

  if (options.lte) {
    if (options.reverse) {
      options.start = options.lte
    } else {
      options.end = options.lte
    }
  }

  const baseQueryInput = {
    TableName: this.db.tableName,
    ScanIndexForward: !options.reverse,
    ExclusiveStartKey: options.ExclusiveStartKey,
    Limit: options.limit
  }
  const queryInput = { ...baseQueryInput, ...keyConditionExpression(this.db.partition, options) }
  this.db.dynamoDBClient
    .send(new QueryCommand(queryInput))
    .then(results => callback(null, results))
    .catch(error => callback(error))
}

module.exports = DynamoDBIterator

function keyConditionExpression (partition, options) {
  const defaultStart = '\u0000'
  const defaultEnd = '\xff\xff\xff\xff\xff\xff\xff\xff'

  if (options.gt && options.lt) {
    return {
      KeyConditionExpression: 'hashKey = :partition and rangeKey between :gt and :lt',
      ExpressionAttributeValues: marshall({ ':partition': partition, ':gt': options.gt, ':lt': options.lt })
    }
  }

  if (options.lt) {
    return {
      KeyConditionExpression: 'hashKey = :partition and rangeKey < :lt',
      ExpressionAttributeValues: marshall({ ':partition': partition, ':lt': options.lt })
    }
  }

  if (options.gt) {
    return {
      KeyConditionExpression: 'hashKey = :partition and rangeKey > :gt',
      ExpressionAttributeValues: marshall({ ':partition': partition, ':gt': options.gt })
    }
  }

  if (!options.start && !options.end) {
    return {
      KeyConditionExpression: 'hashKey = :partition and rangeKey between :gt and :lt',
      ExpressionAttributeValues: marshall({ ':partition': partition, ':gt': defaultStart, ':lt': defaultEnd })
    }
  }

  if (!options.end) {
    return {
      KeyConditionExpression: options.reverse ? 'hashKey = :partition and rangeKey <= :start' : 'hashKey = :partition and rangeKey >= :start',
      ExpressionAttributeValues: marshall({ ':partition': partition, ':start': options.start })
    }
  }

  if (!options.start) {
    return {
      KeyConditionExpression: options.reverse ? 'hashKey = :partition and rangeKey >= :end' : 'hashKey = :partition and rangeKey <= :end',
      ExpressionAttributeValues: marshall({ ':partition': partition, ':end': options.end })
    }
  }

  return {
    KeyConditionExpression: options.reverse ? 'hashKey = :partition and rangeKey between :end and :start' : 'hashKey = :partition and rangeKey between :start and :end',
    ExpressionAttributeValues: marshall({ ':partition': partition, ':start': options.start, ':end': options.end })
  }
}
