// CANON WEAVE — Context
const modifier = (text) => {
  const result = CanonWeave("context", text)
  return { text: result.text, stop: !!result.stop }
}
modifier(text)
