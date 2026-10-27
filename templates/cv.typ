// CV template (Typst). The data comes from cv.json, written by the tailor skill
// and passed by scripts/render.ts as: typst compile cv.typ out.pdf --input data=<json>
// Text from the JSON is inserted as plain strings, never interpreted as markup.
// One column, standard headings, real text (no images): easy for ATS software to read.

#let data = json(bytes(sys.inputs.at("data")))
#let es = data.language == "es"
#let tr(en, es-text) = if es { es-text } else { en }
#let accent = rgb("#1f4e79")

#set document(title: data.name + " - CV", author: data.name)
#set page(paper: "a4", margin: (x: 1.7cm, y: 1.4cm))
#set text(font: ("Arial", "Libertinus Serif"), size: 10pt, lang: data.language)
#set par(leading: 0.55em, spacing: 0.7em)
#set list(indent: 0.4em, body-indent: 0.5em, spacing: 0.45em)

#let section(title) = {
  v(0.5em)
  text(size: 10.5pt, weight: "bold", fill: accent, upper(title))
  v(-0.6em)
  line(length: 100%, stroke: 0.5pt + accent)
  v(-0.1em)
}

#let period(start, end) = {
  let finish = if end == "present" { tr("present", "actualidad") } else { end }
  start + tr(" to ", " a ") + finish
}

#let contact = data.at("contact", default: (:))
#let contact-items = (
  contact.at("location", default: none),
  contact.at("email", default: none),
  contact.at("phone", default: none),
  ..contact.at("links", default: ()),
).filter(item => item != none and item != "")

#align(center)[
  #text(size: 19pt, weight: "bold", data.name)
  #v(-0.4em)
  #text(size: 10.5pt, fill: accent, data.headline)
  #v(-0.3em)
  #text(size: 9pt, contact-items.join("  |  "))
]

#section(tr("Profile", "Perfil"))
#data.summary

#section(tr("Experience", "Experiencia"))
#for job in data.experience {
  let place = job.at("location", default: none)
  grid(
    columns: (1fr, auto),
    [*#job.title*, #job.company#if place != none and place != "" [, #place]],
    text(size: 9pt, period(job.start, job.end)),
  )
  v(-0.4em)
  list(..job.bullets.map(bullet => [#bullet]))
  v(0.2em)
}

#section(tr("Education and certificates", "Formación y certificados"))
#for item in data.education {
  let detail = item.at("detail", default: none)
  grid(
    columns: (1fr, auto),
    [*#item.degree*, #item.institution],
    text(size: 9pt, item.year),
  )
  if detail != none and detail != "" {
    v(-0.4em)
    text(size: 9pt, detail)
  }
}

#section(tr("Skills", "Competencias"))
#for group in data.skills [
  *#group.group:* #group.items.join(", ") \
]

#section(tr("Languages", "Idiomas"))
#data.languages.map(l => l.language + " (" + l.level + ")").join(", ")
