class SocketServices {
  // connection socket
  connection(socket) {
    socket.on("disconnect", () => {
      console.log(`User disconnect id is ${socket.id}`);
    });

    socket.on("noti_client_payment", (data) => {
      console.log("noti_client_payment:", data);
      _io.emit("noti_client_payment", data);
    });
  }
}

module.exports = new SocketServices();
