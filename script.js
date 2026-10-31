
const CLAVE_ALMACENAMIENTO = "estock_insur_es_v1";

const porId = (id) => document.getElementById(id);

// ID compatible con navegadores que todavía no implementan crypto.randomUUID().
function generarId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return "prod-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

function numero(valor) {
  if (typeof valor === "number") return valor;

  const texto = String(valor ?? "").trim().replace(/\s/g, "");

  if (texto.includes(",") && texto.includes(".")) {
    return Number(texto.replace(/\./g, "").replace(",", ".")) || 0;
  }

  return Number(texto.replace(",", ".")) || 0;
}

function crearEstadoInicial() {
  return {
    productos: [],
    movimientos: [],
    ventas: [],
    configuracion: {
      eur: 0.92,
      ves: 36,
      bcvEurVes: null,
      bcvFecha: "",
      nombreEmpresa: "ESTOCK INSUR",
      moneda: "USD"
    }
  };
}

function cargarEstado() {
  try {
    const datos = JSON.parse(
      localStorage.getItem(CLAVE_ALMACENAMIENTO)
    );

    if (!datos) return crearEstadoInicial();

    const inicial = crearEstadoInicial();

    return {
      ...inicial,
      ...datos,
      productos: Array.isArray(datos.productos) ? datos.productos : [],
      movimientos: Array.isArray(datos.movimientos) ? datos.movimientos : [],
      ventas: Array.isArray(datos.ventas) ? datos.ventas : [],
      configuracion: {
        ...inicial.configuracion,
        ...(datos.configuracion || {})
      }
    };
  } catch (error) {
    console.error("Error al cargar los datos:", error);
    return crearEstadoInicial();
  }
}

let estado = cargarEstado();

function guardarEstado() {
  try {
    localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify(estado));
  } catch (error) {
    console.error("No se pudieron guardar los datos en este navegador:", error);
    mostrarToast("No se pudo guardar. Verifica que el almacenamiento del navegador esté permitido.");
  }
}

function escapar(valor) {
  return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caracter]);
}

function mostrarToast(mensaje) {
  const toast = porId("toast");

  if (!toast) {
    alert(mensaje);
    return;
  }

  toast.textContent = mensaje;
  toast.classList.add("visible");

  clearTimeout(mostrarToast.temporizador);

  mostrarToast.temporizador = setTimeout(() => {
    toast.classList.remove("visible");
  }, 3000);
}

function formatoDinero(valor) {
  const moneda = estado.configuracion.moneda || "USD";

  const tasas = {
    USD: 1,
    EUR: numero(estado.configuracion.eur),
    VES: numero(estado.configuracion.ves)
  };

  const valorConvertido = valor * (tasas[moneda] || 1);

  try {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: moneda,
      maximumFractionDigits: 2
    }).format(valorConvertido);
  } catch {
    return `${valorConvertido.toFixed(2)} ${moneda}`;
  }
}

function fechaActual() {
  return new Date().toISOString();
}

function fechaVisible(fecha) {
  if (!fecha) return "—";

  return new Date(fecha).toLocaleString("es-ES", {
    dateStyle: "short",
    timeStyle: "short"
  });
}

function obtenerProducto(id) {
  return estado.productos.find(
    producto => producto.id === id
  );
}

function valorInventario() {
  return estado.productos.reduce(
    (total, producto) =>
      total + producto.cantidad * producto.costo,
    0
  );
}

function valorPotencial() {
  return estado.productos.reduce(
    (total, producto) =>
      total + producto.cantidad * producto.precio,
    0
  );
}

function totalFacturado() {
  return estado.ventas.reduce(
    (total, venta) => total + venta.total,
    0
  );
}

function productosBajos() {
  return estado.productos.filter(
    producto => producto.cantidad > 0 &&
      producto.cantidad <= producto.minimo
  );
}

function productosAgotados() {
  return estado.productos.filter(
    producto => producto.cantidad <= 0
  );
}

function actualizarSelects() {
  const selects = [
    porId("productoMovimiento"),
    porId("productoVenta")
  ];

  selects.forEach(select => {
    if (!select) return;

    const valorAnterior = select.value;

    select.innerHTML =
      '<option value="">Seleccionar producto</option>' +
      estado.productos.map(producto => `
        <option value="${escapar(producto.id)}">
          ${escapar(producto.nombre)} (${producto.cantidad} unidades)
        </option>
      `).join("");

    if (estado.productos.some(p => p.id === valorAnterior)) {
      select.value = valorAnterior;
    }
  });
}

function renderizarDashboard() {
  const total = porId("total");
  const unidades = porId("unidades");
  const bajo = porId("bajo");
  const agotados = porId("agotados");

  if (total) total.textContent = estado.productos.length;

  if (unidades) {
    unidades.textContent = estado.productos.reduce(
      (suma, producto) => suma + producto.cantidad,
      0
    );
  }

  if (bajo) bajo.textContent = productosBajos().length;

  if (agotados) agotados.textContent = productosAgotados().length;

  const busqueda = (
    porId("busquedaDashboard")?.value || ""
  ).toLowerCase();

  const productos = estado.productos.filter(producto =>
    `${producto.nombre} ${producto.codigo} ${producto.marca}`
      .toLowerCase()
      .includes(busqueda)
  );

  const tabla = porId("tablaDashboard");
  if (!tabla) return;

  tabla.innerHTML = productos.length
    ? productos.map(producto => `
      <tr>
        <td>${escapar(producto.nombre)}</td>
        <td>${escapar(producto.codigo)}</td>
        <td>${escapar(producto.marca)}</td>
        <td>${producto.cantidad}</td>
        <td>${formatoDinero(producto.precio)}</td>
        <td>${estadoProducto(producto)}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="6">No hay productos registrados.</td></tr>';
}

function estadoProducto(producto) {
  if (producto.cantidad <= 0) {
    return '<span class="estado agotado">Agotado</span>';
  }

  if (producto.cantidad <= producto.minimo) {
    return '<span class="estado bajo">Stock bajo</span>';
  }

  return '<span class="estado disponible">Disponible</span>';
}

function renderizarProductos() {
  const tabla = porId("tablaProductos");
  if (!tabla) return;

  const busqueda = (
    porId("busquedaProductos")?.value || ""
  ).toLowerCase();

  const filtro = porId("filtroDisponibilidad")?.value || "todos";
  const productos = estado.productos.filter(producto => {
    const coincide = `${producto.nombre} ${producto.codigo} ${producto.marca} ${producto.vehiculo}`.toLowerCase().includes(busqueda);
    const disponible = producto.cantidad > 0;
    const bajo = disponible && producto.cantidad <= producto.minimo;
    const estadoCoincide = filtro === "todos" ||
      (filtro === "disponible" && disponible) ||
      (filtro === "agotado" && !disponible) ||
      (filtro === "bajo" && bajo);
    return coincide && estadoCoincide;
  });

  const contador = porId("contadorProductos");
  if (contador) {
    contador.textContent = `${productos.length} productos`;
  }

  tabla.innerHTML = productos.length
    ? productos.map(producto => `
      <tr>
        <td>${escapar(producto.codigo)}</td>
        <td class="product-name-cell">${escapar(producto.nombre)}</td>
        <td><strong class="stock-number">${producto.cantidad}</strong></td>
        <td>${estadoProducto(producto)}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="4">No se encontraron productos.</td></tr>';

  const tablaGestion = porId("tablaGestionProductos");
  if (tablaGestion) {
    const busquedaGestion = (porId("busquedaGestion")?.value || "").toLowerCase();
    const listaGestion = estado.productos.filter(producto =>
      `${producto.codigo} ${producto.nombre} ${producto.marca}`.toLowerCase().includes(busquedaGestion)
    );
    tablaGestion.innerHTML = listaGestion.length
      ? listaGestion.map(producto => `
        <tr><td>${escapar(producto.codigo)}</td><td class="product-name-cell">${escapar(producto.nombre)}</td><td><strong class="stock-number">${producto.cantidad}</strong></td><td>${estadoProducto(producto)}</td>
        <td><button type="button" class="btn-eliminar" data-eliminar-producto="${escapar(producto.id)}">Eliminar</button></td></tr>
      `).join("")
      : '<tr><td colspan="5">No hay productos que coincidan.</td></tr>';
  }
}

function renderizarMovimientos() {
  const tabla = porId("tablaMovimientos");
  if (!tabla) return;

  tabla.innerHTML = estado.movimientos.length
    ? [...estado.movimientos].reverse().map(movimiento => `
      <tr>
        <td>${fechaVisible(movimiento.fecha)}</td>
        <td>${escapar(movimiento.productoNombre)}</td>
        <td>${movimiento.tipo === "entrada" ? "Entrada" : "Salida"}</td>
        <td>${movimiento.cantidad}</td>
        <td>${escapar(movimiento.observacion || "—")}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="5">No hay movimientos registrados.</td></tr>';
}

function renderizarVentas() {
  const tabla = porId("tablaVentas");
  if (!tabla) return;

  const totalVentas = porId("totalVentas");
  const facturacion = porId("facturacion");

  if (totalVentas) totalVentas.textContent = estado.ventas.length;

  if (facturacion) {
    facturacion.textContent = formatoDinero(totalFacturado());
  }

  tabla.innerHTML = estado.ventas.length
    ? [...estado.ventas].reverse().map(venta => `
      <tr>
        <td>${fechaVisible(venta.fecha)}</td>
        <td>${escapar(venta.productoNombre)}</td>
        <td>${escapar(venta.cliente || "Cliente general")}</td>
        <td>${venta.cantidad}</td>
        <td>${formatoDinero(venta.precio)}</td>
        <td>${formatoDinero(venta.total)}</td>
      </tr>
    `).join("")
    : '<tr><td colspan="6">No hay ventas registradas.</td></tr>';
}

function renderizarInformes() {
  const inventario = porId("valorInventario");
  const potencial = porId("valorPotencial");
  const reposicion = porId("productosReposicion");
  const movimientos = porId("totalMovimientos");
  const tabla = porId("tablaAlertas");

  if (inventario) inventario.textContent = formatoDinero(valorInventario());
  if (potencial) potencial.textContent = formatoDinero(valorPotencial());

  if (reposicion) {
    reposicion.textContent =
      productosBajos().length + productosAgotados().length;
  }

  if (movimientos) {
    movimientos.textContent = estado.movimientos.length;
  }

  if (tabla) {
    const alertas = [
      ...productosAgotados(),
      ...productosBajos()
    ].filter((producto, indice, lista) =>
      lista.findIndex(p => p.id === producto.id) === indice
    );

    tabla.innerHTML = alertas.length
      ? alertas.map(producto => `
        <tr>
          <td>${escapar(producto.nombre)}</td>
          <td>${escapar(producto.codigo)}</td>
          <td>${producto.cantidad}</td>
          <td>${producto.minimo}</td>
          <td>${estadoProducto(producto)}</td>
        </tr>
      `).join("")
      : '<tr><td colspan="5">No hay alertas de stock.</td></tr>';
  }
}

const URL_TAXAS_BCV = "https://bcv.today/api/v1/rate.json";

function formatoTaxa(valor, casas = 4) {
  return Number(valor).toLocaleString("es-VE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: casas
  });
}

async function atualizarTaxasBCV(mostrarMensagem = true) {
  const status = porId("statusTaxasBCV");
  const botao = porId("actualizarTaxasBCV");
  if (status) status.textContent = "Consultando tasas oficiales del BCV...";
  if (botao) botao.disabled = true;

  try {
    const resposta = await fetch(URL_TAXAS_BCV, { cache: "no-cache" });
    if (!resposta.ok) throw new Error(`Respuesta HTTP ${resposta.status}`);
    const dados = await resposta.json();
    const usdVes = Number(dados.USD);
    const eurVes = Number(dados.EUR);

    if (!Number.isFinite(usdVes) || !Number.isFinite(eurVes) || usdVes <= 0 || eurVes <= 0) {
      throw new Error("La API no devolvió tasas válidas.");
    }

    // El sistema guarda los precios base en USD: eur es EUR por USD y ves es VES por USD.
    estado.configuracion.ves = usdVes;
    estado.configuracion.eur = usdVes / eurVes;
    estado.configuracion.bcvEurVes = eurVes;
    estado.configuracion.bcvFecha = dados.effective_date || dados.date || "";
    guardarEstado();
    renderizar();

    if (porId("bcvUsd")) porId("bcvUsd").textContent = `1 USD = ${formatoTaxa(usdVes)} Bs.`;
    if (porId("bcvEur")) porId("bcvEur").textContent = `1 EUR = ${formatoTaxa(eurVes)} Bs.`;
    if (porId("bcvEurUsd")) porId("bcvEurUsd").textContent = `1 EUR ≈ ${formatoTaxa(eurVes / usdVes)} USD`;

    const fecha = estado.configuracion.bcvFecha;
    if (status) status.textContent = `Tasas actualizadas. Fecha de vigencia BCV: ${fecha || "no informada"}.`;
    if (mostrarMensagem) mostrarToast("Tasas del BCV actualizadas y guardadas.");
    return true;
  } catch (error) {
    console.error("No se pudieron actualizar las tasas del BCV:", error);
    if (status) status.textContent = "No fue posible consultar el BCV. Revisa la conexión y vuelve a intentarlo; se conservaron las tasas guardadas.";
    if (mostrarMensagem) mostrarToast("No se pudieron actualizar las tasas. Se conservaron los valores anteriores.");
    return false;
  } finally {
    if (botao) botao.disabled = false;
  }
}

function mostrarTaxasGuardadas() {
  const usdVes = numero(estado.configuracion.ves);
  const eurVes = Number(estado.configuracion.bcvEurVes);
  if (usdVes > 0 && porId("bcvUsd")) porId("bcvUsd").textContent = `1 USD = ${formatoTaxa(usdVes)} Bs.`;
  if (Number.isFinite(eurVes) && eurVes > 0 && porId("bcvEur")) porId("bcvEur").textContent = `1 EUR = ${formatoTaxa(eurVes)} Bs.`;
  if (Number.isFinite(eurVes) && eurVes > 0 && usdVes > 0 && porId("bcvEurUsd")) porId("bcvEurUsd").textContent = `1 EUR ≈ ${formatoTaxa(eurVes / usdVes)} USD`;
  if (estado.configuracion.bcvFecha && porId("statusTaxasBCV")) porId("statusTaxasBCV").textContent = `Última tasa guardada. Fecha de vigencia BCV: ${estado.configuracion.bcvFecha}.`;
}

function rellenarConfiguracion() {
  const formulario = porId("formTasas");
  if (!formulario) return;

  const configuracion = estado.configuracion;

  if (formulario.elements.eur) {
    formulario.elements.eur.value = configuracion.eur;
  }

  if (formulario.elements.ves) {
    formulario.elements.ves.value = configuracion.ves;
  }

  if (formulario.elements.nombreEmpresa) {
    formulario.elements.nombreEmpresa.value =
      configuracion.nombreEmpresa;
  }

  if (formulario.elements.moneda) {
    formulario.elements.moneda.value = configuracion.moneda;
  }
}

function renderizar() {
  renderizarDashboard();
  renderizarProductos();
  renderizarMovimientos();
  renderizarVentas();
  renderizarInformes();
  actualizarSelects();
  rellenarConfiguracion();
}

function mostrarPagina(nombre) {
  document.querySelectorAll("[data-page]").forEach(elemento => {
    elemento.classList.toggle("activo", elemento.dataset.page === nombre);
  });

  document.querySelectorAll(".pagina").forEach(pagina => {
    pagina.classList.toggle("activa", pagina.id === `pagina-${nombre}`);
  });
}

document.querySelectorAll(".nav-link").forEach(enlace => {
  enlace.addEventListener("click", () => {
    mostrarPagina(enlace.dataset.page);
  });
});

porId("busquedaDashboard")?.addEventListener("input", renderizarDashboard);
porId("busquedaProductos")?.addEventListener("input", renderizarProductos);
porId("filtroDisponibilidad")?.addEventListener("change", renderizarProductos);
porId("busquedaGestion")?.addEventListener("input", renderizarProductos);

porId("formProducto")?.addEventListener("submit", evento => {
  evento.preventDefault();

  const datos = new FormData(evento.currentTarget);

  const nombre = String(datos.get("nombre") || "").trim();
  const codigo = String(datos.get("codigo") || "").trim();

  if (!nombre || !codigo) {
    mostrarToast("Introduce el nombre y el código del producto.");
    return;
  }

  if (estado.productos.some(p => p.codigo.toLowerCase() === codigo.toLowerCase())) {
    mostrarToast("Ya existe un producto con ese código.");
    return;
  }

  const producto = {
    id: generarId(),
    nombre,
    codigo,
    cantidad: Math.max(0, Math.floor(numero(datos.get("cantidad")))),
    minimo: 0,
    costo: Math.max(0, numero(datos.get("costo"))),
    precio: Math.max(0, numero(datos.get("precio"))),
    fecha: fechaActual()
  };

  estado.productos.push(producto);

  if (producto.cantidad > 0) {
    estado.movimientos.push({
      id: generarId(),
      productoId: producto.id,
      productoNombre: producto.nombre,
      tipo: "entrada",
      cantidad: producto.cantidad,
      observacion: "Stock inicial",
      fecha: fechaActual()
    });
  }

  guardarEstado();
  evento.currentTarget.reset();
  renderizar();
  mostrarToast("Producto registrado correctamente.");
});

porId("tablaGestionProductos")?.addEventListener("click", evento => {
  const boton = evento.target.closest("[data-eliminar-producto]");
  if (!boton) return;

  const producto = obtenerProducto(boton.dataset.eliminarProducto);
  if (!producto) return;

  const confirmar = confirm(
    `¿Eliminar el producto "${producto.nombre}"?`
  );

  if (!confirmar) return;

  estado.productos = estado.productos.filter(p => p.id !== producto.id);

  guardarEstado();
  renderizar();
  mostrarToast("Producto eliminado.");
});

porId("formMovimiento")?.addEventListener("submit", evento => {
  evento.preventDefault();

  const datos = new FormData(evento.currentTarget);
  const producto = obtenerProducto(String(datos.get("productoId") || ""));
  const tipo = String(datos.get("tipo") || "");
  const cantidad = Math.floor(numero(datos.get("cantidad")));
  const observacion = String(datos.get("observacion") || "").trim();

  if (!producto || !["entrada", "salida"].includes(tipo) || cantidad <= 0) {
    mostrarToast("Revisa el producto, el tipo y la cantidad.");
    return;
  }

  if (tipo === "salida" && cantidad > producto.cantidad) {
    mostrarToast("No hay suficiente stock para esa salida.");
    return;
  }

  producto.cantidad += tipo === "entrada" ? cantidad : -cantidad;

  estado.movimientos.push({
    id: generarId(),
    productoId: producto.id,
    productoNombre: producto.nombre,
    tipo,
    cantidad,
    observacion,
    fecha: fechaActual()
  });

  guardarEstado();
  evento.currentTarget.reset();
  renderizar();
  mostrarToast("Movimiento registrado correctamente.");
});

porId("formVenta")?.addEventListener("submit", evento => {
  evento.preventDefault();

  const datos = new FormData(evento.currentTarget);
  const producto = obtenerProducto(String(datos.get("productoId") || ""));
  const cantidad = Math.floor(numero(datos.get("cantidad")));
  const precioIngresado = datos.get("precio");
  const precio = precioIngresado === "" || precioIngresado === null
    ? producto?.precio || 0
    : numero(precioIngresado);

  const cliente = String(datos.get("cliente") || "").trim();

  if (!producto || cantidad <= 0 || precio < 0) {
    mostrarToast("Revisa los datos de la venta.");
    return;
  }

  if (cantidad > producto.cantidad) {
    mostrarToast("No hay suficiente stock para completar la venta.");
    return;
  }

  producto.cantidad -= cantidad;

  const venta = {
    id: generarId(),
    productoId: producto.id,
    productoNombre: producto.nombre,
    cantidad,
    precio,
    total: cantidad * precio,
    cliente,
    fecha: fechaActual()
  };

  estado.ventas.push(venta);

  estado.movimientos.push({
    id: generarId(),
    productoId: producto.id,
    productoNombre: producto.nombre,
    tipo: "salida",
    cantidad,
    observacion: `Venta${cliente ? ` a ${cliente}` : ""}`,
    fecha: fechaActual()
  });

  guardarEstado();
  evento.currentTarget.reset();
  renderizar();
  mostrarToast("Venta registrada correctamente.");
});

porId("formTasas")?.addEventListener("submit", evento => {
  evento.preventDefault();

  const datos = new FormData(evento.currentTarget);
  const eur = numero(datos.get("eur"));
  const ves = numero(datos.get("ves"));

  if (eur <= 0 || ves <= 0) {
    mostrarToast("Introduce tasas de cambio válidas.");
    return;
  }

  estado.configuracion.eur = eur;
  estado.configuracion.ves = ves;
  estado.configuracion.nombreEmpresa =
    String(datos.get("nombreEmpresa") || "ESTOCK INSUR").trim();

  estado.configuracion.moneda = String(datos.get("moneda") || "USD");

  guardarEstado();
  renderizar();
  mostrarToast("Configuración guardada correctamente.");
});

porId("limpiarDatos")?.addEventListener("click", () => {
  const confirmar = confirm(
    "¿Seguro que deseas borrar todos los datos guardados en este navegador? Esta acción no se puede deshacer."
  );

  if (!confirmar) return;

  localStorage.removeItem(CLAVE_ALMACENAMIENTO);
  estado = crearEstadoInicial();

  guardarEstado();
  renderizar();

  mostrarToast("Datos del navegador eliminados.");
});

porId("exportarCSV")?.addEventListener("click", () => {
  const filas = [
    ["Código", "Producto", "Marca", "Vehículo", "Cantidad", "Mínimo", "Costo", "Precio"],
    ...estado.productos.map(producto => [
      producto.codigo,
      producto.nombre,
      producto.marca,
      producto.vehiculo,
      producto.cantidad,
      producto.minimo,
      producto.costo,
      producto.precio
    ])
  ];

  const csv = filas.map(fila =>
    fila.map(valor =>
      `"${String(valor ?? "").replace(/"/g, '""')}"`
    ).join(";")
  ).join("\r\n");

  const archivo = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement("a");

  enlace.href = url;
  enlace.download = "estock-insur-productos.csv";
  enlace.click();

  URL.revokeObjectURL(url);
  mostrarToast("Archivo CSV exportado.");
});

renderizar();

// IMPORTAR PRODUCTOS DESDE UN ARCHIVO CSV
// En index.html deben existir:
// <input id="archivoImportacion" type="file" accept=".csv">
// <button id="importarProductos" type="button">Importar productos</button>

function analizarCSV(texto) {
  const lineas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter(linea => linea.trim());
  if (lineas.length < 2) return [];

  function separarLinea(linea, separador) {
    const campos = [];
    let campo = "";
    let dentroComillas = false;

    for (let i = 0; i < linea.length; i++) {
      const caracter = linea[i];

      if (caracter === '"') {
        if (dentroComillas && linea[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          dentroComillas = !dentroComillas;
        }
      } else if (caracter === separador && !dentroComillas) {
        campos.push(campo.trim());
        campo = "";
      } else {
        campo += caracter;
      }
    }

    campos.push(campo.trim());
    return campos;
  }

  const separador = (lineas[0].match(/;/g) || []).length >=
    (lineas[0].match(/,/g) || []).length ? ";" : ",";
  const encabezados = separarLinea(lineas[0], separador)
    .map(valor => valor.replace(/^\uFEFF/, "").trim().toLowerCase());

  return lineas.slice(1).map(linea => {
    const campos = separarLinea(linea, separador);
    const fila = {};
    encabezados.forEach((encabezado, indice) => {
      fila[encabezado] = campos[indice] ?? "";
    });
    return fila;
  });
}

porId("importarProductos")?.addEventListener("click", async () => {
  const selector = porId("archivoImportacion");
  const archivo = selector?.files?.[0];

  if (!archivo) {
    mostrarToast("Selecciona primero el archivo CSV.");
    return;
  }

  if (!archivo.name.toLowerCase().endsWith(".csv")) {
    mostrarToast("Selecciona un archivo .CSV.");
    return;
  }

  try {
    const texto = await archivo.text();
    const filas = analizarCSV(texto);
    let importados = 0;
    let duplicados = 0;
    let invalidos = 0;

    filas.forEach(fila => {
      const codigo = String(fila.codigo ?? fila.cod ?? "").trim();
      const nombre = String(fila.nombre ?? fila.descripcion ?? fila.producto ?? "").trim();

      if (!codigo || !nombre) {
        invalidos++;
        return;
      }

      const yaExiste = estado.productos.some(
        producto => String(producto.codigo).toLowerCase() === codigo.toLowerCase()
      );

      if (yaExiste) {
        duplicados++;
        return;
      }

      const cantidad = Math.max(0, Math.floor(numero(fila.cantidad ?? fila.inventario ?? 0)));
      const producto = {
        id: generarId(),
        codigo,
        nombre,
        marca: String(fila.marca ?? "").trim(),
        vehiculo: String(fila.vehiculo ?? fila.aplicacion ?? "").trim(),
        cantidad,
        minimo: Math.max(0, Math.floor(numero(fila.minimo ?? 0))),
        costo: Math.max(0, numero(fila.costo ?? fila.cost ?? 0)),
        precio: Math.max(0, numero(fila.precio ?? fila["precio 1"] ?? fila.precio1 ?? 0)),
        fecha: fechaActual()
      };

      estado.productos.push(producto);

      if (cantidad > 0) {
        estado.movimientos.push({
          id: generarId(),
          productoId: producto.id,
          productoNombre: producto.nombre,
          tipo: "entrada",
          cantidad,
          observacion: "Importación inicial desde CSV",
          fecha: fechaActual()
        });
      }

      importados++;
    });

    guardarEstado();
    renderizar();

    if (selector) selector.value = "";

    mostrarToast(
      `Importación terminada: ${importados} nuevos, ${duplicados} duplicados omitidos, ${invalidos} filas incompletas.`
    );
  } catch (error) {
    console.error(error);
    mostrarToast("No se pudo leer el CSV. Comprueba que el archivo esté correcto.");
  }
});


// Tasas automáticas: se consultan al abrir el sistema y también desde el botón.
porId("actualizarTaxasBCV")?.addEventListener("click", () => atualizarTaxasBCV(true));
mostrarTaxasGuardadas();
atualizarTaxasBCV(false);


// JARVIS — análisis local del inventario y control por voz.
function normalizarTextoJarvis(texto) {
  return String(texto || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function responderJarvis(pregunta) {
  const q = normalizarTextoJarvis(pregunta);
  const bajos = productosBajos();
  const agotados = productosAgotados();
  const unidades = estado.productos.reduce((s,p)=>s+numero(p.cantidad),0);
  if (!estado.productos.length) return "Todavía no hay productos registrados. Ve a Importar CSV y carga el catálogo.";
  if (q.includes("agotad") || q.includes("sin stock") || q.includes("no disponible")) {
    return agotados.length ? `Hay ${agotados.length} productos agotados:\n` + agotados.slice(0,15).map(p=>`• ${p.codigo} — ${p.nombre}`).join("\n") + (agotados.length>15?`\nY otros ${agotados.length-15}.`:"") : "¡Bien! No hay productos agotados.";
  }
  if (q.includes("bajo") || q.includes("reponer") || q.includes("minimo")) {
    return bajos.length ? `${bajos.length} productos necesitan revisión:\n`+bajos.slice(0,15).map(p=>`• ${p.codigo} — ${p.nombre}: ${p.cantidad} (mínimo ${p.minimo})`).join("\n") : "No hay productos por debajo del mínimo.";
  }
  if (q.includes("venta") || q.includes("factur") || q.includes("vend")) {
    return `Ventas registradas: ${estado.ventas.length}. Facturación acumulada: ${formatoDinero(totalFacturado())}.`;
  }
  const palabras=q.split(/\s+/).filter(w=>w.length>=4 && !["cuanto","stock","tiene","pieza","producto","buscar","cantidad","disponible"].includes(w));
  const coincidencias=estado.productos.filter(p=>{
    const datos=normalizarTextoJarvis(`${p.codigo} ${p.nombre} ${p.marca} ${p.vehiculo}`);
    return palabras.some(w=>datos.includes(w));
  });
  if (coincidencias.length) return coincidencias.slice(0,15).map(p=>`${p.codigo} — ${p.nombre}: ${p.cantidad} unidades, ${p.cantidad>0?"disponible":"agotado"}.`).join("\n");
  if (q.includes("resumen") || q.includes("inventario") || q.includes("analiza") || q.includes("organiza") || q.includes("consejo")) {
    return `Resumen del inventario:\n• ${estado.productos.length} productos\n• ${unidades} unidades\n• ${bajos.length} con stock bajo\n• ${agotados.length} agotados\n• Valor al costo: ${formatoDinero(valorInventario())}\n\nRecomendación: revisa primero los agotados y los artículos con stock bajo.`;
  }
  return "Puedo resumir el inventario, listar agotados, encontrar productos por código o nombre y analizar ventas. Prueba: “¿Qué productos están agotados?”";
}
let jarvisHablar = false;
function mensajeJarvis(texto, tipo) {
  const chat=porId("jarvisChat"); if(!chat) return;
  const el=document.createElement("div"); el.className=`jarvis-message ${tipo}`; el.textContent=texto; chat.appendChild(el); chat.scrollTop=chat.scrollHeight;
  if(tipo==="bot" && jarvisHablar && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
    const voz=new SpeechSynthesisUtterance(texto); voz.lang="es-ES"; window.speechSynthesis.speak(voz);
  }
}
function enviarPreguntaJarvis(texto) {
  texto=String(texto||"").trim(); if(!texto)return;
  mensajeJarvis(texto,"user"); mensajeJarvis(responderJarvis(texto),"bot");
  if(porId("jarvisPregunta")) porId("jarvisPregunta").value="";
}
porId("jarvisForm")?.addEventListener("submit",e=>{e.preventDefault();jarvisHablar=false;enviarPreguntaJarvis(porId("jarvisPregunta")?.value);});
document.querySelectorAll("[data-jarvis]").forEach(b=>b.addEventListener("click",()=>{jarvisHablar=false;enviarPreguntaJarvis(b.dataset.jarvis);}));
// El botón de voz abre el modo inmersivo definido al final del archivo.


// Modo de voz inmersivo de Jarvis.
const voiceMode=porId("jarvisVoiceMode");
const voiceStatus=porId("jarvisVoiceStatus");
const voiceReply=porId("jarvisVoiceReply");
let jarvisRecognition=null;
function abrirModoVoz(){
  if(!voiceMode)return;
  voiceMode.classList.add("active");voiceMode.setAttribute("aria-hidden","false");
  voiceStatus.textContent="Listo para conversar";
  voiceReply.textContent="Toca el micrófono y pregunta sobre tu inventario.";
}
function cerrarModoVoz(){
  if(jarvisRecognition){try{jarvisRecognition.stop()}catch(e){} jarvisRecognition=null;}
  if("speechSynthesis" in window)window.speechSynthesis.cancel();
  voiceMode?.classList.remove("active","listening","speaking");
  voiceMode?.setAttribute("aria-hidden","true");
}
function escucharJarvis(){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){voiceStatus.textContent="Voz no disponible en este navegador. Usa el chat escrito.";return;}
  try{
    if(jarvisRecognition){jarvisRecognition.stop();jarvisRecognition=null;}
    const rec=new SR();jarvisRecognition=rec;rec.lang="es-ES";rec.interimResults=false;rec.maxAlternatives=1;
    rec.onstart=()=>{voiceMode.classList.add("listening");voiceMode.classList.remove("speaking");voiceStatus.textContent="Escuchando…";};
    rec.onresult=e=>{
      const frase=e.results[0][0].transcript;
      voiceMode.classList.remove("listening");voiceStatus.textContent="Procesando…";
      mensajeJarvis(frase,"user");
      const respuesta=responderJarvis(frase);
      mensajeJarvis(respuesta,"bot");
      voiceReply.textContent=respuesta;
      if("speechSynthesis" in window){
        window.speechSynthesis.cancel();
        const utter=new SpeechSynthesisUtterance(respuesta);utter.lang="es-ES";
        utter.onstart=()=>{voiceMode.classList.add("speaking");voiceStatus.textContent="Jarvis está respondiendo…";};
        utter.onend=()=>{voiceMode.classList.remove("speaking");voiceStatus.textContent="Listo para otra pregunta";};
        window.speechSynthesis.speak(utter);
      }else voiceStatus.textContent="Respuesta lista";
    };
    rec.onerror=()=>{voiceMode.classList.remove("listening");voiceStatus.textContent="No pude escuchar. Revisa el permiso del micrófono.";};
    rec.onend=()=>{jarvisRecognition=null;if(voiceMode.classList.contains("listening")){voiceMode.classList.remove("listening");voiceStatus.textContent="Toca el micrófono para intentarlo otra vez.";}}
    rec.start();
  }catch(err){voiceStatus.textContent="No se pudo iniciar el micrófono. Comprueba los permisos.";}
}
porId("jarvisVoz")?.addEventListener("click",abrirModoVoz);
porId("jarvisStartVoice")?.addEventListener("click",abrirModoVoz);
porId("jarvisStartText")?.addEventListener("click",()=>{
  porId("jarvisTextArea")?.scrollIntoView({behavior:"smooth",block:"start"});
  porId("jarvisPregunta")?.focus();
});
porId("jarvisVoiceClose")?.addEventListener("click",cerrarModoVoz);
porId("jarvisVoiceMic")?.addEventListener("click",escucharJarvis);
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&voiceMode?.classList.contains("active"))cerrarModoVoz();});
