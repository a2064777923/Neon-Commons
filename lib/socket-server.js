const {
  getSessionFromRequest,
  GUEST_SCOPE_ERROR
} = require("./auth");
const { resolveRoomEntry } = require("./rooms/directory");
const { getRoomManager } = require("./game/room-manager");
const { getBoardRoomManager } = require("./board/manager");
const { getPartyRoomManager } = require("./party/manager");
const { SOCKET_EVENTS } = require("./shared/network-contract");

function registerSocketHandlers(io) {
  const roomManager = getRoomManager();
  const boardRoomManager = getBoardRoomManager();
  const partyRoomManager = getPartyRoomManager();
  roomManager.attachIo(io);
  boardRoomManager.attachIo(io);
  partyRoomManager.attachIo(io);

  io.use(async (socket, next) => {
    try {
      const session = await getSessionFromRequest({
        headers: socket.handshake.headers || {}
      });
      if (!session) {
        return next(new Error("未登入"));
      }

      socket.session = session;
      socket.user = {
        id: session.id,
        kind: session.kind,
        roomNo: session.roomNo || null,
        gameKey: session.gameKey || null
      };
      return next();
    } catch (error) {
      return next(new Error("登入已失效"));
    }
  });

  io.on("connection", (socket) => {
    socket.on(SOCKET_EVENTS.room.subscribe, ({ roomNo }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.room.error, "card", roomNo, () => {
        roomManager.registerSocket(roomNo, socket.user.id, socket);
      });
    });

    socket.on(SOCKET_EVENTS.room.ready, ({ roomNo, ready }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.room.error, "card", roomNo, () => {
        roomManager.setReady(roomNo, socket.user.id, ready);
      });
    });

    socket.on(SOCKET_EVENTS.room.addBot, ({ roomNo, count }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.room.error, "card", roomNo, () => {
        roomManager.addBot(roomNo, socket.user.id, count || 1);
      });
    });

    socket.on(SOCKET_EVENTS.room.bid, ({ roomNo, value }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.room.error, "card", roomNo, () => {
        roomManager.submitBid(roomNo, socket.user.id, Number(value));
      });
    });

    socket.on(SOCKET_EVENTS.room.play, ({ roomNo, cardIds }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.room.error, "card", roomNo, () => {
        roomManager.submitPlay(roomNo, socket.user.id, cardIds || []);
      });
    });

    socket.on(SOCKET_EVENTS.room.pass, ({ roomNo }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.room.error, "card", roomNo, () => {
        roomManager.pass(roomNo, socket.user.id);
      });
    });

    socket.on(SOCKET_EVENTS.room.trustee, ({ roomNo, trustee }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.room.error, "card", roomNo, () => {
        roomManager.toggleTrustee(roomNo, socket.user.id, trustee);
      });
    });

    socket.on(SOCKET_EVENTS.room.chat, ({ roomNo, type, text }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.room.error, "card", roomNo, () => {
        roomManager.sendChat(roomNo, socket.user.id, { type, text });
      });
    });

    socket.on(SOCKET_EVENTS.party.subscribe, ({ roomNo }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.party.error, "party", roomNo, () => {
        partyRoomManager.registerSocket(roomNo, socket.user.id, socket);
      });
    });

    socket.on(SOCKET_EVENTS.party.ready, ({ roomNo, ready }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.party.error, "party", roomNo, () => {
        partyRoomManager.setReady(roomNo, socket.user.id, ready);
      });
    });

    socket.on(SOCKET_EVENTS.party.addBot, ({ roomNo, count }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.party.error, "party", roomNo, () => {
        partyRoomManager.addBot(roomNo, socket.user.id, count || 1);
      });
    });

    socket.on(SOCKET_EVENTS.party.message, ({ roomNo, text }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.party.error, "party", roomNo, () => {
        partyRoomManager.sendRoomMessage(roomNo, socket.user.id, text);
      });
    });

    socket.on(SOCKET_EVENTS.party.action, ({ roomNo, payload }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.party.error, "party", roomNo, () => {
        partyRoomManager.submitAction(roomNo, socket.user.id, payload || {});
      });
    });

    socket.on(SOCKET_EVENTS.board.subscribe, ({ roomNo }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.board.error, "board", roomNo, () => {
        boardRoomManager.registerSocket(roomNo, socket.user.id, socket);
      });
    });

    socket.on(SOCKET_EVENTS.board.ready, ({ roomNo, ready }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.board.error, "board", roomNo, () => {
        boardRoomManager.setReady(roomNo, socket.user.id, ready);
      });
    });

    socket.on(SOCKET_EVENTS.board.addBot, ({ roomNo, count }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.board.error, "board", roomNo, () => {
        boardRoomManager.addBot(roomNo, socket.user.id, count || 1);
      });
    });

    socket.on(SOCKET_EVENTS.board.move, ({ roomNo, payload }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.board.error, "board", roomNo, () => {
        boardRoomManager.submitMove(roomNo, socket.user.id, payload || {});
      });
    });

    socket.on(SOCKET_EVENTS.voice.join, ({ roomNo, muted }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.party.error, "party", roomNo, () => {
        partyRoomManager.voiceJoin(roomNo, socket.user.id, muted);
      });
    });

    socket.on(SOCKET_EVENTS.voice.leave, ({ roomNo }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.party.error, "party", roomNo, () => {
        partyRoomManager.voiceLeave(roomNo, socket.user.id);
      });
    });

    socket.on(SOCKET_EVENTS.voice.state, ({ roomNo, muted }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.party.error, "party", roomNo, () => {
        partyRoomManager.updateVoiceState(roomNo, socket.user.id, muted);
      });
    });

    socket.on(SOCKET_EVENTS.voice.signal, ({ roomNo, targetUserId, data }) => {
      handleScopedEvent(socket, SOCKET_EVENTS.party.error, "party", roomNo, () => {
        partyRoomManager.relayVoiceSignal(roomNo, socket.user.id, targetUserId, data);
      });
    });

    socket.on("disconnect", () => {
      roomManager.unregisterSocket(socket.id);
      boardRoomManager.unregisterSocket(socket.id);
      partyRoomManager.unregisterSocket(socket.id);
    });
  });
}

function handleScopedEvent(socket, errorEvent, familyKey, roomNo, callback) {
  try {
    assertSocketScope(socket, familyKey, roomNo);
    callback();
  } catch (error) {
    socket.emit(errorEvent, { error: error.message });
  }
}

function assertSocketScope(socket, familyKey, roomNo) {
  if (socket.session?.kind !== "guest") {
    return;
  }

  if (familyKey === "card") {
    throw new Error("當前房間不支持遊客加入");
  }

  const expectedRoomNo = String(socket.session.roomNo || "").trim();
  if (!roomNo || String(roomNo).trim() !== expectedRoomNo) {
    throw new Error(GUEST_SCOPE_ERROR);
  }

  const entry = resolveRoomEntry(roomNo, { gameKeyHint: socket.session.gameKey });
  if (!entry || entry.familyKey !== familyKey) {
    throw new Error(GUEST_SCOPE_ERROR);
  }
}

module.exports = {
  registerSocketHandlers
};
