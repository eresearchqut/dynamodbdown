# @eresearchqut/dynamodbdown

> Dynamodb V3 leveldown store for Node.js.

[![level badge](https://leveljs.org/img/badge.svg)](https://github.com/Level/awesome)
[![npm](https://img.shields.io/npm/v/@eresearchqut/dynamodbdown.svg?label=&logo=npm)](https://www.npmjs.com/package/@eresearchqut/dynamodbdown)
[![Node version](https://img.shields.io/node/v/@eresearchqut/dynamodbdown.svg)](https://www.npmjs.com/package/dynamodbdown)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)


An abstract level down implementation that uses dynamodb as a persistent store. This work is based on 
Klaus Trainer's [DynamoDBDOWN](https://github.com/KlausTrainer/dynamodbdown) with the following changes:

* Uses the V3 version of the dynamodb SDK 
* The client is passed to the implementation
* Tested using the abstract level down test suite (test suite is run manually)

The item size calculator is an adaptation of Zac Charles [dynamodb-calculator](https://zaccharles.github.io/dynamodb-calculator/)

## Usage

Documentation pending (look at test.js to get a basic usage)

## Acknowledgments

DynamoDbDown has been heavily inspired by:

- Klaus Trainer's [DynamoDBDOWN](https://github.com/KlausTrainer/dynamodbdown)
- Rod Vagg's [memdown](https://github.com/Level/memdown)
- Zac Charles [dynamodb-calculator](https://zaccharles.github.io/dynamodb-calculator/) 

## License

[MIT](LICENSE.md) © 2021-present Ryan Bennett and [Contributors](CONTRIBUTORS.md).

