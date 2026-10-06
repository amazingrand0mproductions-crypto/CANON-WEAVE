// CANON WEAVE — Input hook (fail-open)
const modifier = (text) => {
  const original = (typeof text === "string" && text.length) ? text : " "
  try {
    if (typeof CanonWeave !== "function") {
      console.log("[CANON WEAVE] Library function CanonWeave is unavailable in Input hook")
      return { text: original }
    }
    const result = CanonWeave("input", original)
    const next = result && typeof result.text === "string" && result.text.length ? result.text : original
    return { text: next }
  } catch (err) {
    console.log("[CANON WEAVE] Input hook failed open: " + (err && err.message ? err.message : err))
    return { text: original }
  }
}
modifier(text)
