# Guía de uso

Esta guía te acompaña desde cero hasta tu primera candidatura preparada. En la sesión lo hacemos juntos; después te sirve para repetirlo por tu cuenta.

Todo funciona en tu ordenador. Tus documentos y tu perfil se quedan en la carpeta `me/` y solo se envían a Claude (el asistente que hace el trabajo) cuando se lo pides.

## Antes de empezar: qué necesitas

- Un ordenador con Windows 10/11 o macOS.
- Tu CV en PDF o Word. Si tienes varias versiones, trae todas, incluidas las antiguas o más largas: a veces tienen detalles que la última quitó.
- Opcional: cartas de presentación que hayas escrito, tu perfil de LinkedIn en PDF (en tu perfil, "Más" o "Recursos" y luego "Guardar en PDF"), certificados.
- No necesitas cuenta de GitHub ni saber programar.

## Paso 1. Suscribirte a Claude Pro (lo hacemos juntos)

Claude es el asistente que lee tus documentos, evalúa ofertas y escribe tus CV y cartas. Para usarlo desde esta herramienta necesitas una suscripción de pago. Con Pro basta para empezar.

1. Entra en [claude.ai](https://claude.ai) y crea una cuenta (con tu correo o con Google).
2. Ve a la página de planes y elige **Pro**. El precio actual está en [claude.com/pricing](https://claude.com/pricing). Es mensual y puedes cancelarlo cuando quieras desde la configuración de tu cuenta.
3. Paga con tarjeta. La suscripción es tuya, con Anthropic; nosotros no vemos tus datos de pago ni cobramos nada por ella.

Pro tiene un límite de uso que se renueva cada pocas horas. Si un día te avisa de que lo has alcanzado, espera y sigue más tarde.

## Paso 2. Instalar Git y VS Code

- **Git** es lo que descarga el proyecto. Descárgalo de [git-scm.com](https://git-scm.com/downloads) e instálalo dejando todas las opciones por defecto. En Mac, si al clonar (paso 4) te pide instalar las "herramientas de línea de comandos", acepta.
- **VS Code** es el programa donde trabajarás: a la izquierda ves tus carpetas y archivos, a la derecha hablas con Claude. Entra en [code.visualstudio.com/download](https://code.visualstudio.com/download) y elige tu sistema:
  - **Windows:** descarga el instalador de Windows, ábrelo y deja las opciones por defecto.
  - **Mac:** pulsa el botón de Mac. Se descarga un `.zip`: ábrelo y arrastra **Visual Studio Code** a la carpeta **Aplicaciones**. La primera vez que lo abras, el Mac te pedirá confirmar que quieres abrirlo.

## Paso 3. La extensión de Claude y el login (lo hacemos juntos)

1. Abre VS Code. En la barra de la izquierda, pulsa el icono de **Extensiones** (cuatro cuadrados).
2. Busca **Claude Code**, comprueba que el autor es **Anthropic** y pulsa **Instalar**.
3. Abre Claude con su icono (arriba a la derecha del editor o en la barra lateral).
4. Cuando te pida entrar, elige **la cuenta de Claude con suscripción** (no la opción de "Console" o API).
5. Se abre el navegador: entra con la misma cuenta del paso 1 y pulsa **Autorizar**. Vuelve a VS Code.

## Paso 4. Descargar el proyecto

1. En VS Code pulsa `Ctrl+Shift+P` (Mac: `Cmd+Shift+P`), escribe **Git: Clone** y pulsa Intro.
2. Pega esta dirección y pulsa Intro:

   ```
   https://github.com/javiergonzalvezort/suitably-local-test.git
   ```

3. Elige dónde guardarlo (por ejemplo, Documentos) y, cuando pregunte, pulsa **Abrir**.
4. Si pregunta si confías en los autores de la carpeta, responde que sí.

## Paso 5. Poner en marcha

Abre Claude, escribe **`/setup`** y pulsa Intro. Es el comando que pone en marcha la herramienta (también vale escribir "Empecemos").

Claude comprueba tu ordenador e instala lo que falte: Node.js (para los programas del proyecto) y Typst (para los PDF). También activa una protección que impide subir por error tus datos personales a internet.

- Cada vez que quiera ejecutar algo en tu ordenador te pedirá permiso. Para estas instalaciones, acepta.
- **Si ha instalado algo, cierra VS Code del todo y vuelve a abrirlo**, para que reconozca los programas nuevos. Después vuelve a escribir **`/setup`**: sigue donde lo dejó.

Cuando todo esté listo, pasa directamente a crear tu perfil.

## Paso 6. Tu perfil

1. Arrastra tus documentos a la carpeta `me/documents/` en el panel de la izquierda de VS Code.
2. Dile a Claude que ya están.
3. Leerá tus documentos y te hará entre tres y cinco preguntas: qué puestos buscas, dónde, si te mudarías, salario, qué descartas. Puedes saltarte cualquiera.
4. Con eso redacta tu perfil. Revísalo: todo lo que digan tus CV y cartas sale de ahí.

Tu perfil crece con el tiempo. En `me/profile/questions.md` hay preguntas más profundas (motivaciones, logros, historias que contar en una entrevista). Respóndelas cuando puedas, por ejemplo: "Respondo a la pregunta 7: ...". Cuanto más contestes, mejores serán los CV.

## Paso 7. Buscar ofertas

Escribe: **"Busca ofertas"**.

Te preguntará de qué fechas (último día, 3, 7 o 14 días; por defecto 7) y buscará en cuatro portales:

- **Himalayas:** portal de empleo 100% en remoto, con ofertas de todo el mundo y a menudo con el salario indicado.
- **Remote OK:** otro portal de trabajo en remoto, con mucho peso de tecnología, producto, diseño y marketing.
- **Arbeitnow:** portal europeo, sobre todo de Alemania, con muchas ofertas en inglés, remotas en Europa o con ayuda para mudarse.
- **LinkedIn:** la red profesional más grande, con muchas ofertas en España. Se leen sus ofertas públicas sin entrar en tu cuenta y en poca cantidad, porque LinkedIn limita las consultas.

¿Has visto una oferta en otro sitio (InfoJobs, Indeed, la web de una empresa)? Pega el texto o el enlace en Claude y la guarda junto a las demás.

## Paso 8. Ver cuáles encajan

Escribe: **"Evalúa las ofertas"**.

Compara cada requisito con tu perfil y te devuelve tres grupos: las que mejor encajan, otras que cierran pronto y el resto con el motivo por el que puntúan menos. El resultado queda en `me/offers/`.

## Paso 9. CV y carta para una oferta

Escribe, por ejemplo: **"Prepárame el CV y la carta para la oferta 3"** o **"Prepara candidaturas para las cinco mejores"**.

Escribe un CV y una carta adaptados a esa oferta, comprueba que no se ha inventado nada y te los enseña. Pídele cambios hasta que te gusten y genera los PDF, que puedes abrir desde el panel de la izquierda.

**Claude no envía nada.** La candidatura la mandas tú, desde la web de la empresa o por correo.

## Paso 10. Llevar la cuenta y preparar entrevistas

- Cuando envíes una: **"He enviado la de [empresa]"**. Te pregunta qué declaraste (salario, preaviso) y lo apunta en `me/applications/applications.xlsx`, que puedes abrir con Excel.
- Si te llaman: **"Tengo entrevista con [empresa] el martes"**. Prepara preguntas probables con las historias de tu perfil que las responden, información pública de la empresa y preguntas para hacer tú. Con **"Vamos a practicar"** te hace una entrevista de prueba.

## Paso 11. Cuéntanos qué tal

Son dos encuestas cortas y anónimas. Nos ayudan a mejorar la herramienta y las sesiones.

- **Al terminar la sesión:** [Tu opinión sobre la sesión](https://docs.google.com/forms/d/1FhqAbEyvsL2Yv9Me4uARv8oPXZor-2eRhS97c_EAU8o/viewform)
- **Dentro de dos semanas:** [¿Qué tal te va con Suitably?](https://docs.google.com/forms/d/1k6i0RjOyCLbWjdF6I9oF0MWo8gPOwHN5wC644Fsm6O4/viewform)

## Para volver otro día

Abre VS Code (se abre en el proyecto) y abre Claude. Sigue donde lo dejaste.

## Si algo falla

| Qué pasa | Qué hacer |
|---|---|
| Claude dice que no encuentra `node`, `git` o `typst` justo después de instalarlos | Cierra VS Code del todo, ábrelo de nuevo y escribe `/setup`. |
| No sabes qué falta | Pídele a Claude: "Comprueba mi ordenador". |
| VS Code no deja clonar | Falta Git: instálalo (paso 2) y reinicia VS Code. |
| LinkedIn no devuelve ofertas (error 429) | LinkedIn limita las consultas. Espera unas horas y busca una sola vez por sesión. Las demás fuentes siguen funcionando. |
| Claude dice que has llegado al límite de uso | Es el límite de Pro. Espera a que se renueve (te dice cuándo) y sigue. |
| Nada de lo anterior funciona | Plan B: el instalador automático. Windows, en PowerShell: `irm https://raw.githubusercontent.com/javiergonzalvezort/suitably-local-test/main/install.ps1 \| iex`. Mac, en Terminal: `curl -fsSL https://raw.githubusercontent.com/javiergonzalvezort/suitably-local-test/main/install.sh \| bash`. |

## Tus datos

- Todo lo personal está en `me/`. No se sube a ningún sitio.
- Claude (Anthropic) recibe lo que necesita para cada tarea, con tu suscripción y según sus condiciones.
- Si algún día quieres copia de seguridad en GitHub, que sea en un repositorio **privado**, nunca público.

## Para actualizar la herramienta

Pídele a Claude: **"Actualiza el proyecto"**. Descarga la versión nueva sin tocar tu carpeta `me/`.
