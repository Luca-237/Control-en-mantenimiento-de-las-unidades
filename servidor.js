// Importar librerías
const WebSocket = require("ws");
const fs = require("fs").promises;
const path = require("path");
const os = require("os");
const express = require("express");
const http = require("http");

// --- Configuración ---
const PORT = 3000;             // Único puerto (HTTP + WS)
const REGISTROS_DIR = "registros";
const UNIDADES_FILE = "unidades.json";
const ADMIN_PASSWORD = "bomberos2024"; // Cambia esta contraseña

// Función para obtener la IP local
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

// Función para formatear la fecha
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

// Cargar unidades desde archivo JSON
async function loadUnidades() {
  try {
    const data = await fs.readFile(UNIDADES_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    const defaultUnidades = [
      { id: "unidad1", nombre: "Unidad 18 - Ataque Pesado" },
      { id: "unidad2", nombre: "Unidad 20 - Rescate" },
      { id: "unidad3", nombre: "Unidad 23 - Ataque y rescate" },
      { id: "unidad4", nombre: "Unidad 24 - Unidad liviana" },
      { id: "unidad5", nombre: "Unidad 25 - Transporte de personal" },
      { id: "unidad6", nombre: "Unidad 26 - Unidad liviana" },
      { id: "unidad7", nombre: "Unidad 29 - Abastecimiento" },
      { id: "unidad8", nombre: "Unidad 30 - Unidad liviana" }
    ];
    await saveUnidades(defaultUnidades);
    return defaultUnidades;
  }
}

// Guardar unidades
async function saveUnidades(unidades) {
  try {
    await fs.writeFile(UNIDADES_FILE, JSON.stringify(unidades, null, 2), "utf-8");
    return true;
  } catch (error) {
    console.error("Error al guardar unidades:", error);
    return false;
  }
}

async function setup() {
  // Asegurar carpeta de registros
  const dirPath = path.join(__dirname, REGISTROS_DIR);
  await fs.mkdir(dirPath, { recursive: true });

  let unidades = await loadUnidades();

  // Crear servidor HTTP con Express
  const app = express();
  app.use(express.static(__dirname)); // Sirve index.html desde esta carpeta
  const server = http.createServer(app);

  // Crear servidor WebSocket sobre el mismo puerto
  const wss = new WebSocket.Server({ server });

  function broadcastUnidades() {
    const mensaje = JSON.stringify({ tipo: "unidades_actualizadas", unidades });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) client.send(mensaje);
    });
  }

  wss.on("connection", (ws) => {
    console.log("Cliente conectado.");

    ws.send(JSON.stringify({ tipo: "unidades_actualizadas", unidades }));

    ws.on("message", async (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.tipo === "mantenimiento") {
          const timestamp = getFormattedTimestamp();
          const fileName = `${timestamp}_${data.unidad.replace(/\s+/g, "_").replace(/[^\w-]/g, "")}.txt`;
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
          ws.send(JSON.stringify({ tipo: "confirmacion", mensaje: `Mantenimiento registrado para ${data.unidad}` }));

        } else if (data.tipo === "admin") {
          if (data.password !== ADMIN_PASSWORD) {
            ws.send(JSON.stringify({ tipo: "error", mensaje: "Contraseña incorrecta" }));
            return;
          }

          if (data.accion === "agregar") {
            const nuevoId = `unidad${Date.now()}`;
            const nuevaUnidad = { id: nuevoId, nombre: data.nombreUnidad };
            unidades.push(nuevaUnidad);

            if (await saveUnidades(unidades)) {
              broadcastUnidades();
              ws.send(JSON.stringify({ tipo: "confirmacion", mensaje: `✔️ Unidad "${data.nombreUnidad}" agregada exitosamente` }));
            }
          } else if (data.accion === "eliminar") {
            unidades = unidades.filter((u) => u.id !== data.unidadId);

            if (await saveUnidades(unidades)) {
              broadcastUnidades();
              ws.send(JSON.stringify({ tipo: "confirmacion", mensaje: "Unidad eliminada exitosamente" }));
            }
          }
        }
      } catch (error) {
        console.error("Error procesando mensaje:", error);
        ws.send(JSON.stringify({ tipo: "error", mensaje: "❌ Error al procesar la solicitud" }));
      }
    });

    ws.on("close", () => console.log("Cliente desconectado."));
  });

  // Iniciar servidor
  const localIP = getLocalIP();
  server.listen(PORT, () => {
    console.log("Servidor iniciado");
    console.log(` http://${localIP}:${PORT}`);
    console.log(`Los registros se guardarán en: '${REGISTROS_DIR}'`);
    console.log("--- Presiona CTRL+C para detener el servidor ---");
  });
}

setup();
