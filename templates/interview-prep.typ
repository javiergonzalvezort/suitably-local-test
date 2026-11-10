// Interview guide template (Typst). The data comes from interview-prep.json, written
// by the interview-prep skill and passed by scripts/render.ts as --input data=<json>.
// Text from the JSON is inserted as plain strings, never interpreted as markup.

#let data = json(bytes(sys.inputs.at("data")))
#let es = data.language == "es"
#let tr(en, es-text) = if es { es-text } else { en }
#let accent = rgb("#1f4e79")
#let soft = rgb("#eef3f9")
#let muted = rgb("#555555")

#set document(title: tr("Interview prep", "Preparación de entrevista") + " - " + data.company, author: data.name)
#set page(
  paper: "a4",
  margin: (x: 1.9cm, y: 1.7cm),
  footer: context [
    #set text(size: 8pt, fill: muted)
    #data.company, #data.role #h(1fr) #counter(page).display("1 / 1", both: true)
  ],
)
#set text(font: ("Arial", "Libertinus Serif"), size: 10pt, lang: data.language)
#set par(leading: 0.6em, spacing: 0.8em)
#set list(indent: 0.4em, body-indent: 0.5em, spacing: 0.5em)

#let section(title) = {
  v(0.8em)
  block(sticky: true)[
    #text(size: 12pt, weight: "bold", fill: accent, title)
    #v(-0.6em)
    #line(length: 100%, stroke: 0.6pt + accent)
  ]
}

#let bullets(items) = if items.len() > 0 { list(..items.map(item => [#item])) }

#let has(value) = value != none and value != ""

// A fact or a reading with its link and date: "Text (date) url".
#let sourced(item) = {
  let url = item.at("url", default: none)
  let date = item.at("date", default: none)
  [#item.text]
  if has(date) [ #text(fill: muted, "(" + date + ")")]
  if has(url) [ \ #text(size: 8.5pt, fill: accent, link(url, url))]
}

// Title block
#text(size: 9pt, fill: muted, upper(tr("Interview prep", "Preparación de entrevista")))
#v(-0.5em)
#text(size: 18pt, weight: "bold", data.role)
#v(-0.6em)
#text(size: 13pt, fill: accent, data.company)

#let interview = data.interview
#let details = (
  interview.stage,
  interview.at("date", default: none),
  interview.at("format", default: none),
  interview.at("with", default: none),
).filter(has)
#block(fill: soft, inset: 8pt, radius: 3pt, width: 100%, text(size: 9.5pt, details.join("  ·  ")))

#section(tr("Your pitch in 30 seconds", "Tu presentación en 30 segundos"))
#block(inset: (left: 8pt), stroke: (left: 2pt + accent), data.pitch)

#section(tr("What you already said", "Lo que ya dijiste"))
#text(size: 9pt, fill: muted, tr(
  "From your CV, cover letter and application form. Do not contradict it.",
  "De tu CV, carta y formulario. No lo contradigas.",
))
#bullets(data.alreadySaid)

#if data.companyFacts.len() > 0 {
  section(tr("The company", "La empresa"))
  list(..data.companyFacts.map(sourced))
}

#section(tr("Likely questions", "Preguntas probables"))
#let groups = ()
#for q in data.questions {
  if not groups.contains(q.group) { groups.push(q.group) }
}
#let number = 0
#for group in groups {
  v(0.3em)
  text(weight: "bold", group)
  for q in data.questions.filter(q => q.group == group) {
    number += 1
    block(breakable: true, inset: (left: 6pt, y: 4pt), stroke: (left: 1pt + soft.darken(15%)))[
      #text(weight: "bold", fill: accent, str(number) + ". " + q.question) \
      #text(size: 9pt, fill: muted, tr("Why they ask: ", "Por qué lo preguntan: ") + q.why)
      #bullets(q.answer)
      #let story = q.at("story", default: none)
      #if story != none {
        block(fill: soft, inset: 6pt, radius: 3pt, width: 100%, text(size: 9pt)[
          *#tr("Story", "Historia"): #story.title* \
          *#tr("Situation", "Situación"):* #story.situation \
          *#tr("Action", "Acción"):* #story.action \
          *#tr("Result", "Resultado"):* #story.result
        ])
      }
    ]
  }
}

#if data.salary.len() > 0 {
  section(tr("Salary and conditions", "Salario y condiciones"))
  bullets(data.salary)
}

#section(tr("Questions to ask them", "Preguntas para hacerles"))
#bullets(data.askThem)

#section(tr("Before the interview", "Antes de la entrevista"))
#if data.read.len() > 0 {
  text(weight: "bold", tr("Read", "Leer"))
  enum(..data.read.map(sourced))
}
#if data.lookUpYourself.len() > 0 {
  text(weight: "bold", tr("Look up yourself", "Mirar por tu cuenta"))
  bullets(data.lookUpYourself)
}

#section(tr("On the day", "El día de la entrevista"))
#bullets(data.onTheDay)
