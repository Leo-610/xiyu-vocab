/** 解析 multipart/form-data（单文件上传，零依赖） */
export function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const contentType = req.headers['content-type'] || ''
    const match = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
    if (!match) {
      reject(new Error('无效的 multipart 请求'))
      return
    }

    const boundary = match[1] || match[2]
    const chunks = []

    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks)
        const delimiter = Buffer.from(`--${boundary}`)
        const parts = splitBuffer(body, delimiter).filter((p) => p.length > 2)

        const fields = {}
        let file = null

        for (const part of parts) {
          if (part.slice(0, 2).toString() === '--') continue
          const headerEnd = indexOfBuffer(part, Buffer.from('\r\n\r\n'))
          if (headerEnd === -1) continue

          const headerText = part.slice(0, headerEnd).toString('utf8')
          let content = part.slice(headerEnd + 4)
          if (content.slice(-2).toString() === '\r\n') {
            content = content.slice(0, -2)
          }

          const nameMatch = headerText.match(/name="([^"]+)"/i)
          const filenameMatch = headerText.match(/filename="([^"]*)"/i)
          const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i)
          const name = nameMatch?.[1]

          if (filenameMatch && name) {
            file = {
              fieldName: name,
              filename: filenameMatch[1],
              mimeType: typeMatch?.[1]?.trim() || 'application/octet-stream',
              data: content,
            }
          } else if (name) {
            fields[name] = content.toString('utf8')
          }
        }

        resolve({ fields, file })
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function splitBuffer(buffer, delimiter) {
  const parts = []
  let start = 0
  let idx = indexOfBuffer(buffer, delimiter, start)
  while (idx !== -1) {
    if (idx > start) parts.push(buffer.slice(start, idx))
    start = idx + delimiter.length
    idx = indexOfBuffer(buffer, delimiter, start)
  }
  if (start < buffer.length) parts.push(buffer.slice(start))
  return parts
}

function indexOfBuffer(haystack, needle, from = 0) {
  outer: for (let i = from; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer
    }
    return i
  }
  return -1
}
