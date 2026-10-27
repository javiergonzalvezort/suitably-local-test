// Cover letter template (Typst). The data comes from cover-letter.json, written by
// the tailor skill and passed by scripts/render.ts as --input data=<json>.
// Text from the JSON is inserted as plain strings, never interpreted as markup.

#let data = json(bytes(sys.inputs.at("data")))
#let accent = rgb("#1f4e79")

#set document(title: data.name + " - " + data.subject, author: data.name)
#set page(paper: "a4", margin: (x: 2.2cm, y: 2cm))
#set text(font: ("Arial", "Libertinus Serif"), size: 10.5pt, lang: data.language)
#set par(leading: 0.65em, spacing: 1.1em, justify: false)

#let contact = data.at("contact", default: (:))
#let contact-items = (
  contact.at("location", default: none),
  contact.at("email", default: none),
  contact.at("phone", default: none),
  ..contact.at("links", default: ()),
).filter(item => item != none and item != "")

#text(size: 16pt, weight: "bold", data.name)
#v(-0.6em)
#text(size: 9pt, contact-items.join("  |  "))
#v(-0.4em)
#line(length: 100%, stroke: 0.5pt + accent)

#data.date

#data.recipient

#text(weight: "bold", fill: accent, data.subject)

#data.greeting

#for paragraph in data.paragraphs [
  #paragraph

]

#data.closing

#data.name
