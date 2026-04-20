const cookie = require("cookie");
const jwt = require("jsonwebtoken");
const { getRoomManager } = require("./game/room-manager");
const { getBoardRoomManager } = require("./board/manager");
const { getPartyRoomManager } = require("./party/manager");

function registerSocketHandlers(io) {
  const roomManager = getRoomManager();
  const boardRoomManager = getBoardRoomManager();
  const partyRoomManager = getPartyRoomManager();
  roomManager.attachIo(io);
  boardRoomManager.attachIo(io);
  partyRoomManager.attachIo(io);

  io.use((socket, next) => {
    try {
      const cookies = cookie.parse(socket.handshake.headers.cookie || "");
      const token = cookies.ddz_token;
      if (!token) {
        return next(new Error("未登入"));
      }

      const payload = jwt.verify(
        token,
        process.env.JWT_SECRET || "change-this-secret"
      );
      socket.user = payload;
      return next();
    } catch (error) {
      return next(new Error("登入已失效"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("room:subscribe", ({ roomNo }) => {
      try {
        roomManager.registerSocket(roomNo, socket.user.id, socket);
      } catch (error) {
        socket.emit("room:error", { error: error.message });
      }
    });

    socket.on("room:ready", ({ roomNo, ready }) => {
      try {
        roomManager.setReady(roomNo, socket.user.id, ready);
      } catch (error) {
        socket.emit("room:error", { error: error.message });
      }
    });

    socket.on("room:add-bot", ({ roomNo, count }) => {
      try {
        roomManager.addBot(roomNo, socket.user.id, count || 1);
      } catch (error) {
        socket.emit("room:error", { error: error.message });
      }
    });

    socket.on("game:bid", ({ roomNo, value }) => {
      try {
        roomManager.submitBid(roomNo, socket.user.id, Number(value));
      } catch (error) {
        socket.emit("room:error", { error: error.message });
      }
    });

    socket.on("game:play", ({ roomNo, cardIds }) => {
      try {
        roomManager.submitPlay(roomNo, socket.user.id, cardIds || []);
      } catch (error) {
        socket.emit("room:error", { error: error.message });
      }
    });

    socket.on("game:pass", ({ roomNo }) => {
      try {
        roomManager.pass(roomNo, socket.user.id);
      } catch (error) {
        socket.emit("room:error", { error: error.message });
      }
    });

    socket.on("game:trustee", ({ roomNo, trustee }) => {
      try {
        roomManager.toggleTrustee(roomNo, socket.user.id, trustee);
      } catch (error) {
        socket.emit("room:error", { error: error.message });
      }
    });

    socket.on("room:chat", ({ roomNo, type, text }) => {
      try {
        roomManager.sendChat(roomNo, socket.user.id, { type, text });
      } catch (error) {
        socket.emit("room:error", { error: error.message });
      }
    });

    socket.on("party:subscribe", ({ roomNo }) => {
      try {
        partyRoomManager.registerSocket(roomNo, socket.user.id, socket);
      } catch (error) {
        socket.emit("party:error", { error: error.message });
      }
    });

    socket.on("party:ready", ({ roomNo, ready }) => {
      try {
        partyRoomManager.setReady(roomNo, socket.user.id, ready);
      } catch (error) {
        socket.emit("party:error", { error: error.message });
      }
    });

    socket.on("party:add-bot", ({ roomNo, count }) => {
      try {
        partyRoomManager.addBot(roomNo, socket.user.id, count || 1);
      } catch (error) {
        socket.emit("party:error", { error: error.message });
      }
    });

    socket.on("party:message", ({ roomNo, text }) => {
      try {
        partyRoomManager.sendRoomMessage(roomNo, socket.user.id, text);
      } catch (error) {
        socket.emit("party:error", { error: error.message });
      }
    });

    socket.on("party:action", ({ roomNo, payload }) => {
      try {
        partyRoomManager.submitAction(roomNo, socket.user.id, payload || {});
      } catch (error) {
        socket.emit("party:error", { error: error.message });
      }
    });

    socket.on("board:subscribe", ({ roomNo }) => {
      try {
        boardRoomManager.registerSocket(roomNo, socket.user.id, socket);
      } catch (error) {
        socket.emit("board:error", { error: error.message });
      }
    });

    socket.on("board:ready", ({ roomNo, ready }) => {
      try {
        boardRoomManager.setReady(roomNo, socket.user.id, ready);
      } catch (error) {
        socket.emit("board:error", { error: error.message });
      }
    });

    socket.on("board:add-bot", ({ roomNo, count }) => {
      try {
        boardRoomManager.addBot(roomNo, socket.user.id, count || 1);
      } catch (error) {
        socket.emit("board:error", { error: error.message });
      }
    });

    socket.on("board:move", ({ roomNo, payload }) => {
      try {
        boardRoomManager.submitMove(roomNo, socket.user.id, payload || {});
      } catch (error) {
        socket.emit("board:error", { error: error.message });
      }
    });

    socket.on("voice:join", ({ roomNo, muted }) => {
      try {
        partyRoomManager.voiceJoin(roomNo, socket.user.id, muted);
      } catch (error) {
        socket.emit("party:error", { error: error.message });
      }
    });

    socket.on("voice:leave", ({ roomNo }) => {
      try {
        partyRoomManager.voiceLeave(roomNo, socket.user.id);
      } catch (error) {
        socket.emit("party:error", { error: error.message });
      }
    });

    socket.on("voice:state", ({ roomNo, muted }) => {
      try {
        partyRoomManager.updateVoiceState(roomNo, socket.user.id, muted);
      } catch (error) {
        socket.emit("party:error", { error: error.message });
      }
    });

    socket.on("voice:signal", ({ roomNo, targetUserId, data }) => {
      try {
        partyRoomManager.relayVoiceSignal(roomNo, socket.user.id, targetUserId, data);
      } catch (error) {
        socket.emit("party:error", { error: error.message });
      }
    });

    socket.on("disconnect", () => {
      roomManager.unregisterSocket(socket.id);
      boardRoomManager.unregisterSocket(socket.id);
      partyRoomManager.unregisterSocket(socket.id);
    });
  });
}

module.exports = {
  registerSocketHandlers
};
