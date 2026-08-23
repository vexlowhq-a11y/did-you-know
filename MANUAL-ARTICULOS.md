# Manual: cómo subir un artículo a mano

Guía paso a paso para publicar una noticia en Did You Know? desde el panel de administración.

## 1. Abrir el panel

1. Corré `admin/start-admin.bat` (doble clic, o `node admin/server.js` desde una terminal).
2. Abrí `http://localhost:4321` en el navegador.
3. Andá a la pestaña **"Últimas publicadas"**.

## 2. Completar el formulario "Agregar artículo"

### Categoría (obligatorio)
Elegí a qué sección pertenece la noticia (Sports, AI, Technology, etc.).

### Tema (opcional)
Si la categoría tiene temas creados (por ejemplo "Formula 1" dentro de Sports), podés asignar el artículo a uno. Si no querés asignarlo a ninguno, dejá "Sin tema específico". También podés crear un tema nuevo ahí mismo con **"+ Crear tema nuevo…"**.

### Subtema (opcional)
Solo aparece si el tema elegido tiene subtemas (por ejemplo países dentro de "History of the World Champions"). Mismo mecanismo que los temas: elegís uno existente o creás uno nuevo.

### Título (obligatorio)
El título de la noticia, tal como se va a mostrar.

### Slug
Se genera solo a partir del título (por ejemplo "Mi Noticia" → `mi-noticia`). Es el nombre del archivo `.html` final. Podés editarlo a mano si querés una URL distinta — pero si el artículo ya está publicado, no lo cambies, porque el archivo viejo no se borra solo.

### Resumen (dek)
Uno o dos renglones que resumen la noticia, aparecen debajo del título.

### Imagen destacada
Subís un archivo de imagen (jpg/png/etc). Se muestra arriba de la noticia y en las tarjetas de "Últimas publicadas". Si no subís nada, se usa el ícono de la categoría como fondo.

### Video destacado (opcional)
Pegás un link de YouTube o un link de embed (Vimeo, JWPlayer, etc.). Si hay video, se muestra el video en vez de la imagen destacada (el video tiene prioridad).

### Fecha y Tiempo de lectura
Fecha de publicación y un texto libre como "5 min".

### Marcar como Trending ⭐
Si lo tildás, el artículo aparece en la sección Trending y en el Top 5 de la home.

### Cuerpo del artículo
Acá va el texto completo de la noticia. **Si lo dejás vacío, el artículo aparece en los listados pero no tiene página propia** (no se genera un `.html` para él).

El cuerpo entiende una sintaxis simple de texto:

| Qué escribir | Qué genera |
|---|---|
| Una línea en blanco entre dos párrafos | Separa en párrafos (`<p>`) |
| `## Texto` al principio de una línea | Subtítulo (`<h2>`) |
| Líneas seguidas que empiezan con `- ` | Lista con viñetas |
| Una línea que diga exactamente `[publicidad]` | Espacio de anuncio publicitario ahí mismo |
| `**texto**` en cualquier parte de un párrafo | Texto en **negrita** |
| `![descripción](ruta-de-imagen)` en su propia línea | Imagen suelta dentro del cuerpo, con esa descripción como pie de foto |

**Ejemplo completo:**

```
El primer párrafo de la noticia va acá, con **una palabra en negrita** para destacarla.

## Un subtítulo

Otro párrafo después del subtítulo.

- Primer punto de la lista
- Segundo punto de la lista

[publicidad]

![Foto del estadio](img/sports/mi-foto.jpg)

Último párrafo de cierre.
```

No hace falta escribir el `![...](...)` a mano — es más fácil usar el botón de abajo.

### Botón "+ Insertar imagen en el cuerpo"
Subís una imagen nueva (no la destacada, una adicional) y se inserta sola, en el lugar exacto donde tengas el cursor dentro del cuerpo, con el formato `![descripción](ruta)` ya armado. Te va a preguntar una descripción opcional para el pie de foto.

## 3. Guardar

Apretá **"Guardar artículo"**. Esto:
- Guarda los datos en `data/articulos.json`.
- Si el cuerpo tiene contenido, genera la página `.html` del artículo al instante (no hace falta regenerar nada aparte).
- Te muestra un link para ver la página publicada.

## 4. Publicar en internet

Una vez que estés conforme, andá arriba de todo y apretá **"Publicar cambios en internet"**. Esto sube los cambios a GitHub, y desde ahí Vercel actualiza el sitio real solo, en unos minutos.

## Tips

- Podés editar un artículo ya guardado apretando "Editar" en la lista de "Últimas publicadas".
- El botón **"Eliminar seleccionados"** (con los checkboxes) borra varios artículos de una — junto con su página `.html` si la tenían.
- Si vas a publicar varios artículos seguidos, guardalos todos primero y recién al final apretá "Publicar cambios en internet" una sola vez.
