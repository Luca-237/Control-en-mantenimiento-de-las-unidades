const WebSocket = require("ws");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const express = require("express");
const http = require("http");
const PORT = 3000; 
const UNIDADES_FILE = "unidades.json";
const ADMIN_PASSWORD = "bomberos2024"; 




function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}


function getFormattedTimestamp() {
  const now = new Date();
  const pad = (num) => num.toString().padStart(2, "0");

  const year = now.getFullYear();
  const month = pad(now.getMonth() + 1);
  const day = pad(now.getDate());
  const hour = pad(now.getHours());
  const minute = pad(now.getMinutes());
  const second = pad(now.getSeconds());

  return `${year}-${month}-${day}_${hour}-${minute}-${second}`;
}

function sanitizeUnitNameForDirectory(unitName) {
  return unitName.replace(/\s+/g, "_").replace(/[^\w-]/g, "");
}

function generateUnitId() {
  return "unidad" + Date.now();
}

async function ensureUnitDirectories(unidades) {
  for (const unidad of unidades) {
    const sanitizedUnitName = sanitizeUnitNameForDirectory(unidad.nombre);
    const unitDir = path.join(__dirname, sanitizedUnitName);

    try {
      await fs.mkdir(path.join(unitDir, "mantenimiento"), { recursive: true });
      await fs.mkdir(path.join(unitDir, "herramientas_abcm"), {
        recursive: true,
      });
    } catch (error) {
      console.error(`Error creando carpetas para ${unidad.nombre}:`, error);
    }
  }
}

async function removeUnitDirectory(nombreUnidad) {
  const sanitizedUnitName = sanitizeUnitNameForDirectory(nombreUnidad);
  const unitDir = path.join(__dirname, sanitizedUnitName);

  try {
    await fs.rm(unitDir, { recursive: true, force: true });
    console.log(`Carpeta de unidad eliminada: ${sanitizedUnitName}`);
  } catch (error) {
    console.error(`Error eliminando carpeta de ${nombreUnidad}:`, error);
  }
}

async function loadUnidades() {
  try {
    const data = await fs.readFile(UNIDADES_FILE, "utf-8");
    const unidades = JSON.parse(data);
    await ensureUnitDirectories(unidades);
    return unidades;
  } catch {

    const defaultUnidades = [
      {
        id: "unidad1",
        nombre: "Unidad 18 - Ataque Pesado",
        herramientas: [
          "Manguera 75mm",
          "Manguera 45mm",
          "Pitón combinado",
          "Lanza",
          "Hacha",
          "Pala",
        ],
      },
      {
        id: "unidad2",
        nombre: "Unidad 20 - Rescate",
        herramientas: [
          "Equipo de corte",
          "Cizalla hidráulica",
          "Separador",
          "Camilla rígida",
          "Botiquín avanzado",
        ],
      },
      {
        id: "unidad3",
        nombre: "Unidad 23 - Ataque y rescate",
        herramientas: [
          "Manguera 45mm",
          "Pitón",
          "Escalera",
          "Equipo de respiración",
          "Hacha",
        ],
      },
      {
        id: "unidad4",
        nombre: "Unidad 24 - Unidad liviana",
        herramientas: [
          "Extintor portátil",
          "Manguera 25mm",
          "Linterna",
          "Radio portátil",
        ],
      },
      {
        id: "unidad5",
        nombre: "Unidad 25 - Transporte de personal",
        herramientas: ["Botiquín básico", "Megáfono", "Linternas", "Radio base"],
      },
      {
        id: "unidad6",
        nombre: "Unidad 26 - Unidad liviana",
        herramientas: [
          "Extintor portátil",
          "Manguera 25mm",
          "Linterna",
          "Radio portátil",
        ],
      },
      {
        id: "unidad7",
        nombre: "Unidad 29 - Forestal",
        herramientas: [
          "Bomba portátil",
          "Mangueras de succión",
          "Mangotes",
          "Llaves de hidrante",
        ],
      },
      {
        id: "unidad8",
        nombre: "Unidad 30 - Unidad liviana",
        herramientas: [
          "Extintor portátil",
          "Manguera 25mm",
          "Linterna",
          "Radio portátil",
        ],
      },
    ];
    await saveUnidades(defaultUnidades);
    return defaultUnidades;
  }
}

async function saveUnidades(unidades) {
  try {
    await fs.writeFile(
      UNIDADES_FILE,
      JSON.stringify(unidades, null, 2),
      "utf-8"
    );
    console.log("Unidades guardadas correctamente");

    await ensureUnitDirectories(unidades);

    return true;
  } catch (error) {
    console.error("Error al guardar unidades:", error);
    return false;
  }
}

async function setup() {
  let unidades = await loadUnidades();

  const app = express();
  app.use(express.static(__dirname));
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });

  function broadcastUnidades() {
    const mensaje = JSON.stringify({
      tipo: "unidades_actualizadas",
      unidades,
    });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(mensaje);
      }
    });
  }

  wss.on("connection", (ws) => {
    console.log("Cliente conectado.");
    ws.send(
      JSON.stringify({ tipo: "unidades_actualizadas", unidades })
    );

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.tipo === "mantenimiento") {
          const timestamp = getFormattedTimestamp();
          const sanitizedUnitName = sanitizeUnitNameForDirectory(data.unidad);
          const fileName = `${timestamp}_MANTENIMIENTO.txt`;

          const dirPath = path.join(
            __dirname,
            sanitizedUnitName,
            "mantenimiento"
          );
          await fs.mkdir(dirPath, { recursive: true });
          const filePath = path.join(dirPath, fileName);

          const fileContent = `REGISTRO DE MANTENIMIENTO
========================
Unidad: ${data.unidad}
Fecha de registro: ${new Date().toLocaleString("es-AR")}
Operario: ${data.operario}
Observaciones: ${data.observaciones || "Ninguna"}

========================
`;
          await fs.writeFile(filePath, fileContent, "utf-8");
          ws.send(
            JSON.stringify({
              tipo: "confirmacion",
              mensaje: `Mantenimiento registrado para ${data.unidad}`,
            })
          );
        } else if (data.tipo === "agregar_herramienta") {
          const unidad = unidades.find((u) => u.id === data.unidadId);
          if (unidad) {
            if (!unidad.herramientas) unidad.herramientas = [];

            if (!unidad.herramientas.includes(data.herramienta)) {
              unidad.herramientas.push(data.herramienta);
              if (await saveUnidades(unidades)) {
                const timestamp = getFormattedTimestamp();
                const sanitizedUnitName =
                  sanitizeUnitNameForDirectory(unidad.nombre);
                const sanitizedToolName = sanitizeUnitNameForDirectory(
                  data.herramienta
                );
                const fileName = `${timestamp}_ALTA_${sanitizedToolName}.txt`;

                const dirPath = path.join(
                  __dirname,
                  sanitizedUnitName,
                  "herramientas_abcm"
                );
                await fs.mkdir(dirPath, { recursive: true });
                const filePath = path.join(dirPath, fileName);

                const fileContent = `REGISTRO ABCM - ALTA
========================
Unidad: ${unidad.nombre}
Fecha: ${new Date().toLocaleString("es-AR")}
Operario: ${data.operario}
Tipo: ALTA
Herramienta: ${data.herramienta}
Detalle: Nueva herramienta agregada al inventario

========================
`;
                await fs.writeFile(filePath, fileContent, "utf-8");

                broadcastUnidades();
                ws.send(
                  JSON.stringify({
                    tipo: "confirmacion",
                    mensaje: `Herramienta "${data.herramienta}" agregada exitosamente`,
                  })
                );
              } else {
                ws.send(
                  JSON.stringify({
                    tipo: "error",
                    mensaje: "Error al guardar los cambios",
                  })
                );
              }
            } else {
              ws.send(
                JSON.stringify({
                  tipo: "error",
                  mensaje: "⚠ La herramienta ya existe en esta unidad",
                })
              );
            }
          }


        } else if (data.tipo === "abcm") {
          const unidad = unidades.find((u) => u.id === data.unidadId);
          if (unidad) {
            const timestamp = getFormattedTimestamp();
            const sanitizedUnitName =
              sanitizeUnitNameForDirectory(unidad.nombre);
            let fileName, fileContent;
            const tipoDescripcion = data.tipoABCM.toUpperCase();

            if (data.tipoABCM === "baja") {
              if (unidad.herramientas) {
                unidad.herramientas = unidad.herramientas.filter(
                  (h) => h !== data.herramienta
                );
                await saveUnidades(unidades);
                broadcastUnidades();
              }
              const sanitizedToolName =
                sanitizeUnitNameForDirectory(data.herramienta);
              fileName = `${timestamp}_${tipoDescripcion}_${sanitizedToolName}.txt`;
            } else if (
              data.tipoABCM === "cambio" ||
              data.tipoABCM === "modificacion"
            ) {
              const index = unidad.herramientas.indexOf(
                data.herramientaOriginal
              );
              if (index !== -1) {
                unidad.herramientas[index] = data.herramientaNueva;
                await saveUnidades(unidades);
                broadcastUnidades();
              }
              const sanitizedToolName = sanitizeUnitNameForDirectory(
                data.herramientaNueva || data.herramientaOriginal
              );
              fileName = `${timestamp}_${tipoDescripcion}_${sanitizedToolName}.txt`;
            } else {
              const sanitizedToolName =
                sanitizeUnitNameForDirectory(data.herramienta);
              fileName = `${timestamp}_${tipoDescripcion}_${sanitizedToolName}.txt`;
            }

            const dirPath = path.join(
              __dirname,
              sanitizedUnitName,
              "herramientas_abcm"
            );
            await fs.mkdir(dirPath, { recursive: true });
            const filePath = path.join(dirPath, fileName);

            const header = `REGISTRO ABCM - ${tipoDescripcion}
========================
Unidad: ${unidad.nombre}
Fecha: ${new Date().toLocaleString("es-AR")}
Operario: ${data.operario}
Tipo: ${tipoDescripcion}
`;
            let body = "";
            if (
              data.tipoABCM === "cambio" ||
              data.tipoABCM === "modificacion"
            ) {
              body = `Herramienta Original: ${data.herramientaOriginal}
Herramienta Nueva: ${data.herramientaNueva}
Detalle: ${data.detalle}
`;
            } else {
              body = `Herramienta: ${data.herramienta}
Detalle: ${data.detalle}
`;
            }
            const footer = `\n========================\n`;
            fileContent = header + body + footer;

            await fs.writeFile(filePath, fileContent, "utf-8");
            ws.send(
              JSON.stringify({
                tipo: "confirmacion",
                mensaje: `Registro ABCM (${tipoDescripcion}) completado`,
              })
            );
          }


        } else if (data.tipo === "validar_password") {
          const esValido = data.password === ADMIN_PASSWORD;
          ws.send(
            JSON.stringify({
              tipo: "password_validado",
              valido: esValido,
              accion: data.accion, 
              mensaje: esValido
                ? "Contraseña correcta"
                : "Contraseña incorrecta",
            })
          );
        


        } else if (data.tipo === "agregar_unidad") {
          if (data.password !== ADMIN_PASSWORD) {
            ws.send(
              JSON.stringify({
                tipo: "error",
                mensaje: "Contraseña incorrecta",
              })
            );
            return;
          }

          const nuevaUnidad = {
            id: generateUnitId(),
            nombre: data.nombre,
            herramientas: data.herramientas || [],
          };

          unidades.push(nuevaUnidad);
          if (await saveUnidades(unidades)) {
            broadcastUnidades();
            ws.send(
              JSON.stringify({
                tipo: "confirmacion",
                mensaje: `Unidad "${data.nombre}" agregada exitosamente`,
              })
            );
          } else {
            ws.send(
              JSON.stringify({
                tipo: "error",
                mensaje: "Error al guardar la nueva unidad",
              })
            );
          }

        } else if (data.tipo === "modificar_unidad") {
          if (data.password !== ADMIN_PASSWORD) {
            ws.send(
              JSON.stringify({
                tipo: "error",
                mensaje: "Contraseña incorrecta",
              })
            );
            return;
          }

          const unidad = unidades.find((u) => u.id === data.unidadId);
          if (unidad) {
            const oldName = unidad.nombre;
            unidad.nombre = data.nombre;
            if (await saveUnidades(unidades)) {
              if (oldName !== data.nombre) {
                const oldDir = path.join(
                  __dirname,
                  sanitizeUnitNameForDirectory(oldName)
                );
                const newDir = path.join(
                  __dirname,
                  sanitizeUnitNameForDirectory(data.nombre)
                );
                try {
                  await fs.rename(oldDir, newDir);
                  console.log(
                    `Carpeta renombrada: ${oldName} → ${data.nombre}`
                  );
                } catch (error) {
                  console.error(
                    "Error al renombrar carpeta de unidad:",
                    error
                  );
                }
              }
              broadcastUnidades();
              ws.send(
                JSON.stringify({
                  tipo: "confirmacion",
                  mensaje: `Unidad modificada exitosamente`,
                })
              );
            } else {
              ws.send(
                JSON.stringify({
                  tipo: "error",
                  mensaje: "Error al guardar los cambios",
                })
              );
            }
          } else {
            ws.send(
              JSON.stringify({
                tipo: "error",
                mensaje: "Unidad no encontrada",
              })
            );
          }

        } else if (data.tipo === "eliminar_unidad") {
          if (data.password !== ADMIN_PASSWORD) {
            ws.send(
              JSON.stringify({
                tipo: "error",
                mensaje: "Contraseña incorrecta",
              })
            );
            return;
          }

          const index = unidades.findIndex((u) => u.id === data.unidadId);
          if (index !== -1) {
            const unidadEliminada = unidades[index];
            unidades.splice(index, 1);
            if (await saveUnidades(unidades)) {
              await removeUnitDirectory(unidadEliminada.nombre);
              broadcastUnidades();
              ws.send(
                JSON.stringify({
                  tipo: "confirmacion",
                  mensaje: `Unidad "${unidadEliminada.nombre}" eliminada exitosamente`,
                })
              );
            } else {
              ws.send(
                JSON.stringify({
                  tipo: "error",
                  mensaje: "Error al guardar los cambios",
                })
              );
            }
          } else {
            ws.send(
              JSON.stringify({
                tipo: "error",
                mensaje: "Unidad no encontrada",
              })
            );
          }
        }
      } catch (error) {
        console.error("Error procesando mensaje:", error);
        ws.send(
          JSON.stringify({
            tipo: "error",
            mensaje: "Error al procesar la solicitud",
          })
        );
      }
    });

    ws.on("close", () => console.log("Cliente desconectado."));
  });

  const localIP = getLocalIP();
  server.listen(PORT, () => {
    console.log("Servidor iniciado");
    console.log(`Acceso local: http://localhost:${PORT}`);
    console.log(`Acceso en red: http://${localIP}:${PORT}`);
    console.log(`\n La estructura de archivos se generará dinámicamente así:`);
    console.log(`   └── [Nombre_De_Unidad]/`);
    console.log(
      `       ├── mantenimiento/       (aquí los registros de condiciones)`
    );
    console.log(
      `       └── herramientas_abcm/   (aquí los movimientos de herramientas)`
    );
    console.log("\n--- Presiona CTRL+C para detener el servidor ---");
  });
}

setup();




