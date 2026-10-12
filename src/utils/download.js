export function saveDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Allow the browser time to start consuming the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
