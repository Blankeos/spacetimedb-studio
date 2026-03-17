const TITLE_TEMPLATE = "%s | SpacetimeDB Studio"

export default function getTitle(title: string = "Home") {
  return TITLE_TEMPLATE.replace("%s", title)
}
