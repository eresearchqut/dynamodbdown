const BASE_LOGICAL_SIZE_OF_NESTED_TYPES = 1
const LOGICAL_SIZE_OF_EMPTY_DOCUMENT = 3
const { encode } = require('utf8')
const atob = require('atob')
const Decimal = require('decimal.js-light')

// Inspired by https://zaccharles.github.io/dynamodb-calculator/ and adapted for node

const calculateItemSizeInBytes = (item) => {
  if (!item) return 0
  const itemSize = Object.keys(item).reduce((size, key) =>
    size + encode(key).length + calculateAttributeSizeInBytes(item[key]), 0)
  return itemSize
}

const calculateAttributeSizeInBytes = (attribute) => {
  if (!attribute) return 0
  const type = Object.keys(attribute)[0]
  switch (type) {
    case 'NULL' : return 1
    case 'S' : return encode(attribute.S).length
    case 'SS' : return attribute.SS.reduce((size, value) => size + encode(value).length, 0)
    case 'B' : return atob(attribute.B).length
    case 'BS' : return attribute.BS.reduce((size, value) => size + atob(value).length, 0)
    case 'BOOL' : return 1
    case 'N' : return calculateNumberSizeInBytes(attribute.N)
    case 'NS': return attribute.NS.reduce((size, value) => size + calculateNumberSizeInBytes(value).length, 0)
    case 'L' : return attribute.L.reduce((size, value) => size + BASE_LOGICAL_SIZE_OF_NESTED_TYPES + calculateAttributeSizeInBytes(value), LOGICAL_SIZE_OF_EMPTY_DOCUMENT)
    case 'M' : return Object.keys(attribute.M).map((size, key) => size + BASE_LOGICAL_SIZE_OF_NESTED_TYPES + encode(key).length + calculateAttributeSizeInBytes(attribute.M[key]), LOGICAL_SIZE_OF_EMPTY_DOCUMENT)
    default : throw new Error(`cannot calculate attribute type ${type}.`)
  }
}

const calculateNumberSizeInBytes = (number) => {
  if (number === 0) return 1
  const decimal = new Decimal(number)
  const fixed = decimal.toFixed()
  let size = calculateFixedSizeInBytes(fixed.replace('-', '')) + 1
  if (fixed.startsWith('-')) size++
  if (size > 21) size = 21
  return size
}

const calculateFixedSizeInBytes = (fixed) => {
  if (fixed.indexOf('.') !== -1) {
    let [beforeDecimal, afterDecimal] = fixed.split('.')
    if (beforeDecimal === '0') {
      beforeDecimal = ''
      afterDecimal = removeZeros(afterDecimal)
    }
    if (beforeDecimal.length % 2 !== 0) beforeDecimal = 'Z' + beforeDecimal
    if (afterDecimal.length % 2 !== 0) afterDecimal = afterDecimal + 'Z'
    return calculateFixedSizeInBytes(beforeDecimal + afterDecimal)
  }
  fixed = removeZeros(fixed, true)
  return Math.ceil(fixed.length / 2)
}

const removeZeros = (fixed, removeRight) => {
  while (true) {
    const leftZeros = fixed.replace(/^(0{2})/, '')
    if (leftZeros.length === fixed.length) break
    fixed = leftZeros
  }
  // eslint-disable-next-line no-unmodified-loop-condition
  while (true && removeRight) {
    const rightZeros = fixed.replace(/(0{2})$/, '')
    if (rightZeros.length === fixed.length) break
    fixed = rightZeros
  }
  return fixed
}

module.exports = calculateItemSizeInBytes
