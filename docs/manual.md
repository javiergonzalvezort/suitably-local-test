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

## Paso 2. Instalar la herramienta

Abre la terminal:

- **Windows:** pulsa la tecla de Windows, escribe `PowerShell` y ábrelo.
- **Mac:** abre **Terminal** (Aplicaciones > Utilidades). En Mac necesitas antes [Homebrew](https://brew.sh): copia el comando que aparece en su página, pégalo en Terminal y sigue las instrucciones.

Copia y pega esta línea y pulsa Intro:

**Windows**

```powershell
irm https://raw.githubusercontent.com/javiergonzalvezort/suitably-local-test/main/install.ps1 | iex
```

**Mac**

```bash
curl -fsSL https://raw.githubusercontent.com/javiergonzalvezort/suitably-local-test/main/install.sh | bash
```

El instalador pone lo necesario (Git, Node.js, Typst para los PDF y Claude Code), descarga el proyecto en tu carpeta personal (`suitably-local-test`) y al final comprueba que todo esté bien. Si Windows te pide permiso para instalar algo, acepta. Tarda unos minutos.

Cuando termine, **cierra la terminal y abre una nueva**, para que reconozca los programas recién instalados.

## Paso 3. Entrar en Claude desde la terminal (lo hacemos juntos)

En la terminal nueva:

```bash
cd suitably-local-test
claude
```

La primera vez, Claude Code te hace unas preguntas:

1. Elige un tema de colores (el que quieras).
2. Cuando te pregunte cómo entrar, elige **la cuenta de Claude con suscripción** (no la opción de "Console" o API).
3. Se abre el navegador: entra con la misma cuenta del paso 1 y pulsa **Autorizar**. Si el navegador no se abre solo, copia el enlace que aparece en la terminal, ábrelo, y pega en la terminal el código que te dé la página.
4. Si te pregunta si confías en los archivos de esta carpeta, responde que sí.

Ya estás dentro. A partir de aquí le hablas en español, con frases normales.

Para salir, escribe `/exit`. Para volver otro día: abre la terminal, `cd suitably-local-test` y `claude`.

## Paso 4. Tu perfil

1. Copia tus documentos en la carpeta `suitably-local-test/me/documents/` (con el explorador de archivos o el Finder, como cualquier carpeta).
2. En Claude escribe: **"Empecemos"**.
3. Leerá tus documentos y te hará entre tres y cinco preguntas: qué puestos buscas, dónde, si te mudarías, salario, qué descartas. Puedes saltarte cualquiera.
4. Con eso redacta tu perfil. Revísalo: todo lo que diga tus CV y cartas sale de ahí.

Tu perfil crece con el tiempo. En `me/profile/questions.md` hay preguntas más profundas (motivaciones, logros, historias que contar en una entrevista). Respóndelas cuando puedas, por ejemplo: "Respondo a la pregunta 7: ...". Cuanto más contestes, mejores serán los CV.

## Paso 5. Buscar ofertas

Escribe: **"Busca ofertas"**.

Te preguntará de qué fechas (último día, 3, 7 o 14 días; por defecto 7) y buscará en Himalayas, Remote OK, Arbeitnow y LinkedIn.

También puedes pegar una oferta que hayas visto tú (el texto o el enlace) y la guarda.

## Paso 6. Ver cuáles encajan

Escribe: **"Evalúa las ofertas"**.

Compara cada requisito con tu perfil y te devuelve tres grupos: las que mejor encajan, otras que cierran pronto y el resto con el motivo por el que puntúan menos. El resultado queda en `me/offers/`.

## Paso 7. CV y carta para una oferta

Escribe, por ejemplo: **"Prepárame el CV y la carta para la oferta 3"** o **"Prepara candidaturas para las cinco mejores"**.

Escribe un CV y una carta adaptados a esa oferta, comprueba que no se ha inventado nada y te los enseña. Pídele cambios hasta que te gusten y genera los PDF.

**Él no envía nada.** La candidatura la mandas tú, desde la web de la empresa o por correo.

## Paso 8. Llevar la cuenta y preparar entrevistas

- Cuando envíes una: **"He enviado la de [empresa]"**. Te pregunta qué declaraste (salario, preaviso) y lo apunta en `me/applications/applications.xlsx`, que puedes abrir con Excel.
- Si te llaman: **"Tengo entrevista con [empresa] el martes"**. Prepara preguntas probables con las historias de tu perfil que las responden, información pública de la empresa y preguntas para hacer tú. Con **"Vamos a practicar"** te hace una entrevista de prueba.

## Si algo falla

| Qué pasa | Qué hacer |
|---|---|
| La terminal dice que no encuentra `claude`, `node` o `git` | Cierra la terminal, abre una nueva y vuelve a probar. |
| No sabes qué falta | En la carpeta del proyecto, escribe `npm run doctor`. Te dice qué falta y cómo arreglarlo. |
| No se generan los PDF (falta Typst) | Dentro de Claude, en Windows: `! winget install --id Typst.Typst -e`. En Mac: `! brew install typst`. Después sal con `/exit` y vuelve a entrar con `claude`. |
| LinkedIn no devuelve ofertas (error 429) | LinkedIn limita las consultas. Espera unas horas y busca una sola vez por sesión. Las demás fuentes siguen funcionando. |
| Claude dice que has llegado al límite de uso | Es el límite de Pro. Espera a que se renueve (te dice cuándo) y sigue. |
| Windows dice que `winget` no está disponible | Instala "Instalador de aplicación" (App Installer) desde la Microsoft Store y repite el paso 2. |

## Tus datos

- Todo lo personal está en `me/`. No se sube a ningún sitio.
- Claude (Anthropic) recibe lo que necesita para cada tarea, con tu suscripción y según sus condiciones.
- Si algún día quieres copia de seguridad en GitHub, que sea en un repositorio **privado**, nunca público.

## Para actualizar la herramienta

Repite la línea del paso 2. Descarga la versión nueva sin tocar tu carpeta `me/`.
