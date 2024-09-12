const DAMAGE_DELAY = .5;
class Explosion extends GameObject {
  constructor({pos, size = 20, pushBack = 20, damage = 0, timeLen, team, sound = "boom"}) {
    super({pos, size: vec2(size), team});
    this.timer = timeLen ? new Timer(timeLen) : undefined;
    this.pushBack = pushBack;
    this.damage = damage;
    this.damageTimer = undefined;
    SOUND[sound]();
  }
  update() {
    super.update();
    if (!this.timer || this.timer.elapsed()) this.delete = true;
  }
  collidedWith(obj) {
    if (obj instanceof Wall || this.canDie) return;
    const { damage, damageTimer } = this;
    if (!damageTimer && damageTimer.elapsed()) {
      obj.lastFlash = new Timer(.04);
      obj.hp -= damage;
      showDamage(damage, obj);
      if (!damageTimer) this.damageTimer = new Timer(DAMAGE_DELAY);
      else this.damageTimer.set(DAMAGE_DELAY);
    }  
    obj.pushObj(angleRadians(this.pos, obj.pos), this.pushBack);
  }
  render() {
    const halfSize = this.size.scale(.5);
    const randPos = this.pos.add(randVec(this.size).subtract(halfSize));
    circle(randPos, randVec(this.size), "red");
  }
}

class FloatingText extends GameObject {
  constructor(pos, str = "", fontSize = 50, color) {
    super({ pos, color });
    this.fontSize = fontSize;
    this.str = str;
    this.angle = random() * PI2;
    this.timer = new Timer(1);
  }
  update() {
    super.update();
    if (this.timer.elapsed()) this.delete = true;
  }
  render() {
    const { str, pos, timer, fontSize, color } = this;
    const perc = 1 - (timer.getPercent() + .05);
    text(str, pos.move(this.angle, perc * fontSize), perc * fontSize, 0, color);
  }
}

const showDamage = (damage, obj) => {
  if (!isNaN(damage) && damage !== 0) {
    new FloatingText(obj.pos.copy(), -damage, 60, RED);
  }
}
class Bullet extends GameObject {
  constructor({pos, angle, team, weapon}) {
    super({
      pos,
      size: vec2(weapon.size),
      angle,
      color: weapon.color,
      moveSpeed: new Speed(weapon.speed, 1),
      team
    });
    this.weapon = weapon;
    this.range = weapon.range || 40;
    SOUND[weapon.sound || "shoot"]();
  }
  collidedWith(obj) {
    const { pos, team, weapon } = this;
    const { damage } = weapon;
    if (this.canDie) {
      obj.lastFlash = new Timer(.05);
      obj.hp -= damage;
      showDamage(damage, obj);
      console.log("bullet damage", damage)
      if (weapon.explosion) {
        new Explosion({pos: pos.copy(), team, ...weapon.explosion });
      }
    }
    this.delete = true;
  }
  update() {
    super.update();
    const { pos, range, moveSpeed, team, weapon } = this;
    this.range -= moveSpeed.speed * tDiff;
    if (range <= 0) {
      this.delete = true;
      // death explosion
      if (weapon.explosion) new Explosion({pos: pos.copy(), team, ...weapon.explosion});
    }
    // if out of bounds
    const BOUNDS = 5e6;
    if(!this.delete) this.delete = pos.x < -BOUNDS || pos.y < -BOUNDS || pos.y > BOUNDS || pos.x  > BOUNDS;
  }
  render() {
    cube(this.pos, this.size, this.angle, 0, "red", 3);
  }
  toString() {
    return [`range: ${this.range}`, ...super.toString()]
  }
}

class Wall extends GameObject {
  constructor({pos, size}) {
    super({pos, size, color: DARK_BLUE, isSolid: true, team: WALL, canDie: false });
  }
  collidedWith(obj) {
    super.collidedWith(obj);
    if (obj instanceof Bullet || obj instanceof Wall) return;
    const { pos, center, angle, moveSpeed } = obj;
    const immovable = getObjectBounds(this);
    const { top, left, bottom, right } = getObjectBounds(obj);

    const { pushAngle, pushBack, pushTimer } = this;
    const pushBackDelta = pushAngle && pushBack ? pos.delta(pushAngle, pushBack * pushTimer.getPercent()) : vec2(0);
    const delta = pos.delta(angle, moveSpeed.speed).add(pushBackDelta).scale(tDiff);

    const PUSH_BACK = .05;
    const xPush = delta.x + (delta.x > 0 ? 1 : -1) * PUSH_BACK;
    const yPush = delta.y + (delta.y > 0 ? 1 : -1) * PUSH_BACK;
    let overlap = vec2(0);
    if ((immovable.top < bottom && delta.y > 0 && Math.abs(immovable.top - bottom) <= center.y)
      || (immovable.bottom > top && delta.y < 0 && Math.abs(immovable.bottom - top) <= center.y)) {
      obj.pos = pos.addY(-yPush);
    }
    if ((immovable.left < right && delta.x > 0 && Math.abs(immovable.left - right) <= center.x)
      || (immovable.right > left && delta.x < 0 && Math.abs(immovable.right - left) <= center.x)) {
      obj.pos = pos.addX(-xPush);
    }
    // obj.pos = obj.pos.subtract(pushBackDelta);
    // if (distance(pos.scale(.5)) > 10) obj.pos = pos.move(angleRadians(this.pos, pos), 10);
  }
};

class Unit extends GameObject {
  constructor({pos, angle, team, unitName}) {
    const unit = UNIT[unitName];
    const weapon = WEAPON[unit.weaponName];
    super({
      pos,
      size: vec2(...unit.size),
      angle,
      color: unit.color,
      moveSpeed: new Speed(...unit.speed),
      rotateSpeed: new Speed(...unit.rotateSpeed),
      isSolid: true,
      team,
      canDie: true,
    });
    this.weapon = weapon;
    this.lastFired = new Timer(weapon.firingRate);
    this.maxHp = this.hp = unit.hp;
  }
  update() {
    super.update();
    if (this.isFiring && this.lastFired.elapsed()) {
      const { weapon } = this;
      new Bullet({
        pos: this.pos.addY(-9).move(this.angle, this.center.y),
        angle: this.angle,
        range: weapon.range,
        team: this.team,
        weapon,
      });
      this.lastFired.set(weapon.firingRate);
      this.isFiring = false;
    }
    if (this.isDead) {
      this.rotateDirection = 0;
      this.moveDirection = 0;
    }
  }
  render(t) {
    const { pos, size, angle, center, color, hp, maxHp, lastFlash } = this;
    const flash = hp > 0 && !!lastFlash && !lastFlash.elapsed();

    //body
    cube(pos, size, angle, center, flash ? WHITE : color, 3);
    if (hp > 0) {
      //cannon
      cube(pos.addY(-11), vec2(20, 70), angle, vec2(10, 60), flash ? WHITE : DARK_GRAY, 3);
      //cannon head
      cube(pos.addY(-9), vec2(40, 50), angle, vec2(20, 20), flash ? WHITE : GRAY, 4);
    }
    else {
      cube(pos.addY(-9), vec2(40, 40), angle, vec2(20, 20), "black", 1);
    }

    // show hitbox
    if (debug) rect(pos, size, 0, center, color, 1, 1);

    if (hp > 0) {
      // rect(pos.move(normalizeAngle(angle - PI), size.y * .7), size, 0, center, color, 1, 1);
      // const hpPos = pos.addX(size.x * 1.2);
      const hpPos = pos.move(normalizeRad(angle - Math.PI), size.y * .7);
      const hpSize = vec2(20);
      const hpDiff = maxHp - hp;
      if (hpDiff > 0) {
        rect(hpPos, hpSize, angle, 0, flash ? "FFF" : GREEN, maxHp * 3);
        rect(hpPos.addY(-(maxHp - hpDiff) * 9), hpSize, angle, 0, flash ? "FFF" : RED, hpDiff * 3);
        // cube(hpPos, hpSize, angle, 0, flash ? "FFF" : GREEN, maxHp * 3);
        // cube(hpPos.addY(-(maxHp - hpDiff) * 9), hpSize, angle, 0, flash ? "FFF" : RED, hpDiff * 3);
      }
    }
  }
  toString() { return [...super.toString(), `isFiring: ${this.isFiring}`]; }
};

class PlayerUnit extends Unit {
  constructor(pos) {
    const unitName = "PLAYER";
    super({pos, unitName, team: TEAM_FRIEND})
  }
}

class SmartUnit extends Unit {
  constructor({pos, team, unitName, state, defaultState}) {
    super({pos, angle: 1, team, unitName, state});
    const unit = UNIT[unitName];
    this.state = state;
    this.defaultState = defaultState;
    this.color = unit.color;
    this.thinkTimer = new Timer(THINK_RATE);
    this.rotateDirection = 0;
    this.moveDirection = 0;
  }

  findTarget() { return {} };

  update() {
    super.update();
    this.rotate(this.rotateDirection);
    this.move(this.moveDirection);
    if (this.isDead) {
      this.rotateDirection = 0;
      this.moveDirection = 0;
      return;
    }

    if (this.thinkTimer.elapsed()) {
      this.isFiring = false;
      if (this.state === STATE.ATTACK) {
        const distFromTarget = distance(this.pos, player.pos);
        const targetAngle = angleRadians(this.pos, player.pos);
        const angleDiff = normalizeRad(this.angle - targetAngle);
        if (Math.abs(angleDiff) < .3) {
          this.angle = targetAngle;
          if (distFromTarget > ENEMY_ATTACK_RANGE) {
            this.moveDirection = 1;
            this.rotateDirection = 0;
          }
          else {
            this.moveDirection = 0;
            this.isFiring = true;
          }
        }
        // determine rotate direction (rotate -1 left or 1 right)
        if (angleDiff > 0) this.rotateDirection = angleDiff > PI ? 1 : -1;
        else if (angleDiff < 0) this.rotateDirection = angleDiff < -PI ? -1 : 1;

        if (distFromTarget < ENEMY_ATTACK_RANGE) {
          this.isFiring = true;
        }
        else if (distFromTarget > PLAYER_DETECT_RANGE) {
          this.state = this.defaultState;
        }
      }
      if (distance(this.pos, player.pos) <= PLAYER_DETECT_RANGE) {
        this.state = STATE.ATTACK;
      }
      this.thinkTimer.set(THINK_RATE);
    }
  }
}

class EnemyUnit extends SmartUnit {
  constructor({pos, patrolPos, unitName}) {
    super({pos, team: TEAM_ENEMY, unitName, state: STATE.PATROL, defaultState: STATE.PATROL});
    this.patrolPoints = [this.pos.copy(), patrolPos || this.pos.addX(400)];
    this.patrolIndex = 1;
    this.targetDest = this.patrolPoints[this.patrolIndex];
  }
  findTarget() {
    // if (this.state === STATE.ATTACK) this.target = player;
  }
  update() {
    super.update();
    const { patrolPoints, targetDest } = this;
    if (this.state === STATE.PATROL) {
      const targetAngle = angleRadians(this.pos, targetDest);
      const angleDiff = normalizeRad(this.angle - targetAngle);

      if (angleDiff > 0) this.rotateDirection = angleDiff > PI ? 1 : -1;
      else if (angleDiff < 0) this.rotateDirection = angleDiff < -PI ? -1 : 1;

      if (Math.abs(angleDiff) < .3) {
        this.angle = targetAngle;
        this.moveDirection = 1;
        this.rotateDirection = 0;
      }

      if (this.rotateDirection === 0 && this.moveDirection !== 0 && distance(this.pos, targetDest) < TILE_SIZE) {
        this.patrolIndex = (this.patrolIndex + 1) % patrolPoints.length;
        this.targetDest = patrolPoints[this.patrolIndex];
      }

      const distFromTarget = distance(this.pos, player.pos);
      if (distFromTarget <= PLAYER_DETECT_RANGE) {
        this.state = STATE.ATTACK;
      }
    }
  }
  render() {
    if (debug && this.targetDest) circle(this.targetDest, vec2(50), PURPLE);
    super.render();
  }
}
