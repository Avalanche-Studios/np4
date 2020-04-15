import _ from 'lodash'
import PyMarshal from 'py-marshal'
import * as stream from 'stream'

/**
 * A function for parsing shell-like quoted arguments into an array,
 * similar to Python's shlex.split. Also allows quotes mid-way through a string,
 * and parses them out for you. Returns false on failure (from unbalanced quotes).
 * @param {string} str
 */
export function shlex(str: string) {
  const args = _.compact(str.split(' '))
  const out = []
  let lookForClose = -1
  let quoteOpen = false

  for (let x = 0; x < args.length; x++) {
    let arg = args[x]
    let escSeq = false
    let underQuote = false

    for (let y = 0; y < arg.length; y++) {
      if (escSeq) {
        escSeq = false
      } else if (arg[y] === '\\') {
        escSeq = true
      } else if (arg[y] === '"') {
        quoteOpen = !quoteOpen
        underQuote = true
      }
    }
    if (!quoteOpen && lookForClose === -1) {
      if (underQuote) arg = arg.slice(1, -1)
      out.push(arg)
    } else if (quoteOpen && lookForClose === -1) {
      lookForClose = x
    } else if (!quoteOpen && lookForClose >= 0) {
      let block = args.slice(lookForClose, x + 1).join(' ')

      let escSeq = false

      const quotes = []

      for (let y = 0; y < block.length; y++) {
        if (escSeq) {
          escSeq = false
        } else if (block[y] === '\\') {
          escSeq = true
        } else if (block[y] === '"') {
          quotes.push(y)
        }
      }
      const parts = []

      parts.push(block.substr(0, quotes[0]))
      parts.push(block.substr(quotes[0] + 1, quotes[1] - (quotes[0] + 1)))
      parts.push(block.substr(quotes[1] + 1))
      block = parts.join('')
      out.push(block)
      lookForClose = -1
    }
  }
  return quoteOpen ? [] : out
}

/**
 * Takes output from p4 -G and parses it to an object.
 * @param {string} outString - The output from P4 (String or Buffer)
 * @returns {object} the result
 */
export function convertOut(outString: Buffer | string) {
  const buf = Buffer.isBuffer(outString) ? outString : Buffer.from(outString)
  const result: any = []
  let i = 0
  let prompt = ''
  const bufLength = buf.length

  // Look for the start of a valid answer
  while (i < bufLength) {
    const elt = buf.toString('ascii', i, i + 1)

    if (elt === '{') break
    prompt += elt
    i++
  }
  result.push({ code: 'prompt', prompt: prompt })

  const decoder = new PyMarshal(buf.slice(i))
  while (decoder.moreData) {
    result.push(decoder.read())
  }

  return result
}

/**
 * Takes a object and transform it in marshal format and input into stream to p4 -G
 * @param {object} inObject - The input string or buffer to analyse
 * @param {SimpleStream} inputStream - A writable stream where result will be sent
 * @returns {string} the result
 */
export function writeMarshal (inObject: object, inputStream: stream.Writable) {
  if (typeof inObject === 'string') {
    inputStream.write(Buffer.from(inObject))
  } else {
    inputStream.write(PyMarshal.writeToBuffer(inObject))
  }
  inputStream.end()
}
