const { v4: uuidv4 } = require('uuid');
const CombatSession = require('../models/CombatSession');
const Campaign = require('../models/Campaign');
const Monster = require('../models/Monster');
const CustomCreature = require('../models/CustomCreature');

// ── Helpers ───────────────────────────────────────────────────────────────────

function roll(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function modifier(score) {
  return Math.floor((score - 10) / 2);
}

function parseDice(expr) {
  // parses "2d6+3", "1d8", "d4" → { count, sides, bonus }
  const m = (expr || '').match(/^(\d*)d(\d+)([+-]\d+)?$/i);
  if (!m) return { count: 1, sides: 6, bonus: 0 };
  return {
    count: parseInt(m[1] || '1', 10),
    sides: parseInt(m[2], 10),
    bonus: parseInt(m[3] || '0', 10),
  };
}

function rollDice(expr) {
  const { count, sides, bonus } = parseDice(expr);
  let total = bonus;
  const rolls = [];
  for (let i = 0; i < count; i++) {
    const r = roll(sides);
    rolls.push(r);
    total += r;
  }
  return { total, rolls, expr };
}

function addLog(combat, message, type = 'system') {
  combat.combatLog.push({ message, type, timestamp: new Date() });
  // Cap log at 200 entries
  if (combat.combatLog.length > 200) combat.combatLog.shift();
}

async function getOrCreateCombat(sessionId, campaignId) {
  let combat = await CombatSession.findOne({ sessionId });
  if (!combat) {
    combat = await CombatSession.create({ sessionId, campaignId, state: 'idle' });
  }
  return combat;
}

// ── Handler registration ──────────────────────────────────────────────────────

function registerCombatHandlers(io, socket, room, session) {

  // ── Start combat ─────────────────────────────────────────────────────────────
  socket.on('combat:start', async ({ playerIds, monsters, customIds }) => {
    if (!socket.isDM) return;
    try {
      const campaign = await Campaign.findById(session.campaignId);
      if (!campaign) return;

      let combat = await getOrCreateCombat(session._id, session.campaignId);
      if (combat.state === 'active') return socket.emit('error', { message: 'Combat already active' });

      const combatants = [];

      // Add selected players
      for (const pid of (playerIds || [])) {
        const player = campaign.players.id(pid);
        if (!player) continue;
        const dex = modifier(player.stats?.DEX || 10);
        combatants.push({
          entityId:   pid,
          entityType: 'player',
          instanceId: pid,
          name:       player.name,
          initiative: roll(20) + dex,
          currentHp:  player.combat?.hpCurrent ?? 0,
          maxHp:      player.combat?.hpMax ?? 0,
          ac:         player.combat?.AC ?? 10,
          level:      player.level,
          class:      player.class,
          race:       player.race,
        });
      }

      // Add SRD monsters
      for (const m of (monsters || [])) {
        const monster = await Monster.findById(m.monsterId);
        if (!monster) continue;
        const count = m.count || 1;
        for (let i = 0; i < count; i++) {
          const dex = modifier(monster.stats?.DEX || 10);
          combatants.push({
            entityId:   monster._id.toString(),
            entityType: 'monster',
            instanceId: uuidv4(),
            name:       count > 1 ? `${monster.name} #${i + 1}` : monster.name,
            initiative: roll(20) + dex,
            currentHp:  monster.hp?.average ?? 0,
            maxHp:      monster.hp?.average ?? 0,
            ac:         monster.AC ?? 10,
            cr:         monster.cr,
            actions:          monster.actions          ?? [],
            reactions:        monster.reactions        ?? [],
            traits:           monster.traits           ?? [],
            legendaryActions: monster.legendaryActions ?? [],
          });
        }
      }

      // Add custom creatures
      for (const cid of (customIds || [])) {
        const creature = await CustomCreature.findById(cid);
        if (!creature) continue;
        const dex = modifier(creature.stats?.DEX || 10);
        combatants.push({
          entityId:   creature._id.toString(),
          entityType: 'custom',
          instanceId: uuidv4(),
          name:       creature.name,
          initiative: roll(20) + dex,
          currentHp:  creature.hp?.max ?? 10,
          maxHp:      creature.hp?.max ?? 10,
          ac:         creature.ac ?? 10,
          cr:         creature.cr,
          actions:  creature.actions ?? [],
          traits:   creature.traits  ?? [],
        });
      }

      // Sort by initiative descending
      combatants.sort((a, b) => b.initiative - a.initiative);

      combat.initiativeOrder  = combatants;
      combat.state            = 'active';
      combat.round            = 1;
      combat.currentTurnIndex = 0;
      combat.pendingActions   = [];
      combat.combatLog        = [];
      addLog(combat, `⚔ Combat started — Round 1`, 'system');
      addLog(combat, `Initiative order: ${combatants.map(c => `${c.name} (${c.initiative})`).join(', ')}`, 'system');

      await combat.save();

      // Flip session phase
      session.phase = 'combat';
      await session.save();

      io.to(room).emit('combat:state', combat);
      io.to(room).emit('session:phase', 'combat');
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── End combat ────────────────────────────────────────────────────────────────
  socket.on('combat:end', async () => {
    if (!socket.isDM) return;
    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      if (!combat) return;

      addLog(combat, `🏁 Combat ended — ${combat.round} round(s)`, 'system');
      combat.state = 'ended';
      await combat.save();

      // Sync final HP back to campaign player documents
      const campaign = await Campaign.findById(session.campaignId);
      if (campaign) {
        let dirty = false;
        for (const c of combat.initiativeOrder) {
          if (c.entityType !== 'player') continue;
          const player = campaign.players.id(c.entityId);
          if (!player) continue;
          player.combat.hpCurrent = c.currentHp;
          dirty = true;
        }
        if (dirty) {
          await campaign.save();
          // Notify all clients of updated player HP
          io.to(room).emit('campaign:playersUpdated', {
            players: campaign.players.map(p => ({
              _id: p._id,
              combat: p.combat,
            })),
          });
        }
      }

      session.phase = 'open-world';
      await session.save();

      io.to(room).emit('combat:state', combat);
      io.to(room).emit('session:phase', 'open-world');
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Next turn ─────────────────────────────────────────────────────────────────
  socket.on('combat:nextTurn', async () => {
    if (!socket.isDM) return;
    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      if (!combat || combat.state !== 'active') return;

      const order = combat.initiativeOrder;
      let next = combat.currentTurnIndex;

      // Advance, skipping defeated combatants
      for (let i = 0; i < order.length; i++) {
        next = (next + 1) % order.length;
        if (!order[next].isDefeated) break;
        if (next === combat.currentTurnIndex) break; // all defeated edge case
      }

      // Check for new round
      if (next <= combat.currentTurnIndex) {
        combat.round += 1;
        addLog(combat, `✦ Round ${combat.round} begins`, 'system');
      }

      // Reset resources for the entity whose turn is starting
      const current = order[next];
      current.actionSpent      = false;
      current.bonusActionSpent = false;
      current.reactionSpent    = false;

      combat.currentTurnIndex = next;
      addLog(combat, `▶ ${current.name}'s turn`, 'system');
      await combat.save();

      io.to(room).emit('combat:state', combat);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── HP update (DM direct) ─────────────────────────────────────────────────────
  socket.on('combat:setHp', async ({ instanceId, hp }) => {
    if (!socket.isDM) return;
    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      if (!combat) return;

      const combatant = combat.initiativeOrder.find(c => c.instanceId === instanceId);
      if (!combatant) return;

      const prev = combatant.currentHp;
      combatant.currentHp = Math.max(0, Math.min(hp, combatant.maxHp));

      const diff = combatant.currentHp - prev;
      if (diff < 0) {
        addLog(combat, `${combatant.name} takes ${Math.abs(diff)} damage (${combatant.currentHp}/${combatant.maxHp} HP)`, 'damage');
      } else if (diff > 0) {
        addLog(combat, `${combatant.name} heals ${diff} HP (${combatant.currentHp}/${combatant.maxHp} HP)`, 'heal');
      }

      if (combatant.currentHp === 0 && prev > 0) {
        combatant.isDefeated = true;
        addLog(combat, `💀 ${combatant.name} drops to 0 HP`, 'condition');
      } else if (combatant.currentHp > 0 && prev === 0) {
        combatant.isDefeated = false;
      }

      await combat.save();
      io.to(room).emit('combat:state', combat);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Condition toggle (DM direct) ─────────────────────────────────────────────
  socket.on('combat:setCondition', async ({ instanceId, condition, active }) => {
    if (!socket.isDM) return;
    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      if (!combat) return;

      const combatant = combat.initiativeOrder.find(c => c.instanceId === instanceId);
      if (!combatant) return;

      const set = new Set(combatant.conditions);
      if (active) {
        set.add(condition);
        addLog(combat, `${combatant.name} gains condition: ${condition}`, 'condition');
      } else {
        set.delete(condition);
        addLog(combat, `${combatant.name} loses condition: ${condition}`, 'condition');
      }
      combatant.conditions = [...set];

      await combat.save();
      io.to(room).emit('combat:state', combat);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Custom tag (DM direct) ────────────────────────────────────────────────────
  socket.on('combat:addTag', async ({ instanceId, label, color }) => {
    if (!socket.isDM) return;
    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      if (!combat) return;

      const combatant = combat.initiativeOrder.find(c => c.instanceId === instanceId);
      if (!combatant) return;

      combatant.customTags.push({ label, color: color || 'yellow' });
      addLog(combat, `${combatant.name} tagged: ${label}`, 'condition');
      await combat.save();
      io.to(room).emit('combat:state', combat);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  socket.on('combat:removeTag', async ({ instanceId, tagIndex }) => {
    if (!socket.isDM) return;
    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      if (!combat) return;

      const combatant = combat.initiativeOrder.find(c => c.instanceId === instanceId);
      if (!combatant) return;

      const removed = combatant.customTags[tagIndex];
      combatant.customTags.splice(tagIndex, 1);
      if (removed) addLog(combat, `${combatant.name} tag removed: ${removed.label}`, 'condition');
      await combat.save();
      io.to(room).emit('combat:state', combat);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Resource spent/restore (DM direct) ───────────────────────────────────────
  socket.on('combat:setResource', async ({ instanceId, resource, spent }) => {
    if (!socket.isDM) return;
    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      if (!combat) return;

      const c = combat.initiativeOrder.find(c => c.instanceId === instanceId);
      if (!c) return;

      if (resource === 'action')      c.actionSpent      = spent;
      if (resource === 'bonus')       c.bonusActionSpent = spent;
      if (resource === 'reaction')    c.reactionSpent    = spent;
      await combat.save();
      io.to(room).emit('combat:state', combat);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── DM freetext log entry ─────────────────────────────────────────────────────
  socket.on('combat:dmNote', async ({ message }) => {
    if (!socket.isDM) return;
    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      if (!combat) return;

      addLog(combat, message, 'dm_note');
      await combat.save();
      io.to(room).emit('combat:state', combat);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Player submits action ─────────────────────────────────────────────────────
  socket.on('combat:submitAction', async ({ actionType, description, params }) => {
    if (socket.isDM) return; // DM uses direct resolves
    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      if (!combat || combat.state !== 'active') return;

      // Validate it's this player's turn
      const current = combat.initiativeOrder[combat.currentTurnIndex];
      const isPlayerTurn = current && current.entityId === socket.characterId;
      if (!isPlayerTurn) {
        return socket.emit('combat:actionRejected', { reason: "It's not your turn." });
      }

      const action = {
        actionId:      uuidv4(),
        submittedBy:   socket.characterId,
        submitterName: socket.displayName,
        actionType,
        description,
        params: params || {},
        status: 'pending',
        submittedAt: new Date(),
      };
      combat.pendingActions.push(action);
      await combat.save();

      socket.emit('combat:actionPending', { actionId: action.actionId });
      io.to(room).emit('combat:state', combat); // DM sees queue update
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── DM approves action ────────────────────────────────────────────────────────
  socket.on('combat:approveAction', async ({ actionId, override }) => {
    if (!socket.isDM) return;
    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      if (!combat) return;

      const action = combat.pendingActions.find(a => a.actionId === actionId);
      if (!action || action.status !== 'pending') return;

      action.status = 'approved';
      const params = override || action.params;

      // Auto-resolve supported action types
      await resolveAction(combat, action, params, io, room);

      await combat.save();
      io.to(room).emit('combat:state', combat);
      io.to(room).emit('combat:actionResolved', { actionId, status: 'approved' });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── DM rejects action ─────────────────────────────────────────────────────────
  socket.on('combat:rejectAction', async ({ actionId, reason }) => {
    if (!socket.isDM) return;
    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      if (!combat) return;

      const action = combat.pendingActions.find(a => a.actionId === actionId);
      if (!action || action.status !== 'pending') return;

      action.status = 'rejected';
      action.dmNote = reason || '';
      addLog(combat, `✗ ${action.submitterName}'s ${action.actionType} rejected${reason ? ': ' + reason : ''}`, 'system');

      await combat.save();
      io.to(room).emit('combat:state', combat);
      io.to(room).emit('combat:actionResolved', { actionId, status: 'rejected', reason });
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Request current combat state ──────────────────────────────────────────────
  socket.on('combat:getState', async () => {
    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      socket.emit('combat:state', combat || null);
    } catch (err) {
      socket.emit('error', { message: err.message });
    }
  });

  // ── Roll broadcast ────────────────────────────────────────────────────────────
  socket.on('roll:public', async ({ formula, result, rollType, context }) => {
    const name = socket.isDM ? 'DM' : socket.displayName;
    const message = `🎲 ${name} rolls ${context || formula} → ${result}`;

    try {
      const combat = await CombatSession.findOne({ sessionId: session._id });
      if (combat && combat.state === 'active') {
        addLog(combat, message, 'roll');
        await combat.save();
        io.to(room).emit('combat:state', combat);
      } else {
        // World phase — just broadcast
        io.to(room).emit('world:roll', { name, formula, result, rollType, context, message });
      }
    } catch {
      io.to(room).emit('world:roll', { name, formula, result, rollType, context, message });
    }
  });
}

// ── Action resolver ───────────────────────────────────────────────────────────

async function resolveAction(combat, action, params, io, room) {
  const { actionType } = action;

  if (actionType === 'attack') {
    const { attackBonus = 0, damageDice = '1d6', damageBonus = 0, damageType = '', targetInstanceId, targetName } = params;
    const attackRoll = Math.floor(Math.random() * 20) + 1;
    const total = attackRoll + parseInt(attackBonus, 10);
    const target = combat.initiativeOrder.find(c => c.instanceId === targetInstanceId);
    const targetAC = target?.ac ?? 0;

    if (attackRoll === 1) {
      addLog(combat, `⚔ ${action.submitterName} attacks ${targetName || '?'} — CRITICAL MISS (rolled 1)`, 'action');
    } else if (attackRoll === 20 || total >= targetAC) {
      const dmg = rollDice(damageDice);
      const totalDmg = Math.max(0, dmg.total + parseInt(damageBonus, 10));
      if (target) {
        target.currentHp = Math.max(0, target.currentHp - totalDmg);
        if (target.currentHp === 0) {
          target.isDefeated = true;
          addLog(combat, `💀 ${target.name} drops to 0 HP`, 'condition');
        }
      }
      const crit = attackRoll === 20 ? ' CRITICAL HIT!' : '';
      addLog(combat, `⚔ ${action.submitterName} hits ${targetName || '?'} for ${totalDmg} ${damageType} damage${crit} (roll: ${attackRoll}+${attackBonus}=${total} vs AC ${targetAC})`, 'damage');
    } else {
      addLog(combat, `⚔ ${action.submitterName} attacks ${targetName || '?'} — MISS (roll: ${attackRoll}+${attackBonus}=${total} vs AC ${targetAC})`, 'action');
    }

    // Mark action spent
    const actor = combat.initiativeOrder.find(c => c.entityId === action.submittedBy);
    if (actor) actor.actionSpent = true;
  }

  else if (actionType === 'heal') {
    const { healDice = '1d8', healModifier = 0, targetInstanceId, targetName } = params;
    const healed = rollDice(healDice);
    const total = Math.max(0, healed.total + parseInt(healModifier, 10));
    const target = combat.initiativeOrder.find(c => c.instanceId === targetInstanceId);
    if (target) {
      const wasDefeated = target.currentHp === 0;
      target.currentHp = Math.min(target.maxHp, target.currentHp + total);
      if (wasDefeated && target.currentHp > 0) target.isDefeated = false;
    }
    addLog(combat, `❤ ${action.submitterName} heals ${targetName || '?'} for ${total} HP (${healDice}+${healModifier})`, 'heal');
    const actor = combat.initiativeOrder.find(c => c.entityId === action.submittedBy);
    if (actor) {
      if (params.isBonus) actor.bonusActionSpent = true;
      else actor.actionSpent = true;
    }
  }

  else if (actionType === 'multiAttack') {
    const { attacks = [], targetInstanceId, targetName } = params;
    let totalDmg = 0;
    const target = combat.initiativeOrder.find(c => c.instanceId === targetInstanceId);
    const lines = [];
    for (const atk of attacks) {
      if (atk.autoHit) {
        const dmg = rollDice(atk.damageDice || '1d4');
        totalDmg += dmg.total;
        lines.push(`auto-hit ${dmg.total}`);
      } else {
        const r = Math.floor(Math.random() * 20) + 1;
        const t = r + parseInt(atk.attackBonus || 0, 10);
        if (r === 20 || t >= (target?.ac ?? 0)) {
          const dmg = rollDice(atk.damageDice || '1d6');
          totalDmg += dmg.total;
          lines.push(`hit ${dmg.total}`);
        } else {
          lines.push(`miss`);
        }
      }
    }
    if (target) {
      target.currentHp = Math.max(0, target.currentHp - totalDmg);
      if (target.currentHp === 0) {
        target.isDefeated = true;
        addLog(combat, `💀 ${target.name} drops to 0 HP`, 'condition');
      }
    }
    addLog(combat, `⚔ ${action.submitterName} → ${targetName || '?'}: ${lines.join(', ')} = ${totalDmg} total damage`, 'damage');
    const actor = combat.initiativeOrder.find(c => c.entityId === action.submittedBy);
    if (actor) actor.actionSpent = true;
  }

  else {
    // Cast spell, improvise, use item, bonus, reaction — log as freetext, DM applies effects manually
    addLog(combat, `✦ ${action.submitterName}: ${action.description}`, 'action');
    const actor = combat.initiativeOrder.find(c => c.entityId === action.submittedBy);
    if (actor) {
      if (params.isBonus)   actor.bonusActionSpent = true;
      else if (params.isReaction) actor.reactionSpent = true;
      else actor.actionSpent = true;
    }
  }
}

module.exports = { registerCombatHandlers };
