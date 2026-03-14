import app from "./server.ts";

app.listen({
    port: 3000,
    hostname: "0.0.0.0"
});

console.log(
    `🦊 Svoy AI is running at ${app.server?.hostname}:${app.server?.port}`
);