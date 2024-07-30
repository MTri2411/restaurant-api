class SocketServices {
  // connection socket
  connection(socket) {
    socket.on("disconnect", () => {
      console.log(`User connect id is ${socket.id}`);
    });

    socket.on("chat_message", (msg) => {
      console.log(`msg is: ${msg}`);
      _io.emit("received_message", msg);
    });
  }
}

module.exports = new SocketServices();
