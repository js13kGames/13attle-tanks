class Explosion extends GameObject {
  constructor({pos, size = 20, pushBack = 20, damage = 0, timeLen, team}) {
    super({pos, size: vec2(size), team});
    this.timeLeft = new Timer(timeLen || .3);
    this.pushBack = pushBack;
    this.damage = damage;
    SOUND.boom();
  }
  update() {
    if (this.timeLeft.elapsed()) this.delete = true;
  }
  collidedWith(obj) {
    if (obj instanceof Wall) return;
    obj.hp -= this.damage;
    obj.pos = obj.pos.move(angleRadians(this.pos, obj.pos), this.pushBack);
  }
  render() {
    const halfSize = this.size.scale(.5);
    const randPos = this.pos.add(randVec(this.size).subtract(halfSize));
    circle(randPos, randVec(this.size), "red");
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
    this.damage = 1;
    this.pushBack = 10;
    SOUND.shoot();
  }
  collidedWith(obj) {
    const { pos, team, weapon } = this;
    obj.hp -= this.damage;
    this.lastFlash = new Timer(.05);
    if (weapon.explosion) new Explosion({pos: pos.copy(), team, ...weapon.explosion});
    this.delete = true;
  }
  update() {
    super.update();
    const { pos, range, moveSpeed, team, weapon } = this;
    this.range -= moveSpeed.speed * tDiff;
    if (range <= 0) {
      this.delete = true;
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
    const delta = pos.delta(angle, moveSpeed.speed).scale(tDiff);

    const PUSH_BACK = .05;
    const xPush = (delta.x > 0 ? 1 : -1) * PUSH_BACK;
    const yPush = (delta.y > 0 ? 1 : -1) * PUSH_BACK;
    if (immovable.top < bottom && delta.y > 0 && Math.abs(immovable.top - bottom) <= center.y) {
      obj.pos = pos.addY(-(delta.y + yPush));
    }
    else if (immovable.bottom > top && delta.y < 0 && Math.abs(immovable.bottom - top) <= center.y) {
      obj.pos = pos.addY(-(delta.y + yPush));
    }
    if (immovable.left < right && delta.x > 0 && Math.abs(immovable.left - right) <= center.x) {
      obj.pos = pos.addX(-(delta.x + xPush));
    }
    else if (immovable.right > left && delta.x < 0 && Math.abs(immovable.right - left) <= center.x) {
      obj.pos = pos.addX(-(delta.x + xPush));
    }
  }
};

class Unit extends GameObject {
  constructor({pos, angle, team, unitName}) {
    const unit = UNIT[unitName];
    console.log(unitName, unit, unit.weaponName)
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

    rect(pos, size, 0, center, color, 1, 1);
    if (hp > 0) {
      const hpPos = pos.addX(size.x * 1.2);
      const hpSize = vec2(20);
      const hpDiff = maxHp - hp;
      if (hpDiff > 0) {
        cube(hpPos, hpSize, 1, 0, flash ? "FFF" : GREEN, maxHp * 3);
        cube(hpPos.addY(-(maxHp - hpDiff) * 9), hpSize, 1, 0, flash ? "FFF" : RED, hpDiff * 3);
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
  constructor({pos, team, unitName, state}) {
    const unit = UNIT[unitName];
    super({pos, angle: 1, team, unitName, state});
    this.state = this.defaultState = state;
    this.color = unit.color;
    this.thinkTimer = new Timer(THINK_RATE);
    this.rotateDirection = 1;
    this.moveDirection = 0;
  }

  update() {
    super.update();
    this.rotate(this.rotateDirection);
    this.move(this.moveDirection);
    if (this.isDead) return;

    if (this.thinkTimer.elapsed()) {
      this.isFiring = false;
      if (!this.target) this.findTarget();
      const distFromTarget = distance(this.pos, this.target.pos);
      if (this.state === STATE.ATTACK) {
        const targetAngle = angleRadians(this.pos, player.pos);
        const angleDiff = this.angle - targetAngle;
        if (Math.abs(angleDiff) < .5) {
          this.angle = targetAngle;//Math.floor(targetAngle * 100) / 100;
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
        if (angleDiff > 0) this.rotateDirection = angleDiff > Math.PI ? 1 : -1;
        else if (angleDiff < 0) this.rotateDirection = angleDiff < -Math.PI ? -1 : 1

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
  render() {
    if (this.targetDest) circle(this.targetDest, vec2(50), PURPLE);
    super.render();
    // const targetAngle = angleRadians(this.pos, this.targetDest);
    // text(`${this.angle} === ${targetAngle}`, this.pos, 20, 0, "black");
    //text(str, pos, fontSize, angle, color, scaleParam = 1)
  }
}

class EnemyUnit extends SmartUnit {
  constructor({pos, patrolPos, team, unitName}) {
    super({pos, patrolPos, team, unitName, state: STATE.PATROL});
    this.patrolPoints = [this.pos.copy(), this.pos.add(patrolPos || vec2(200))];
    this.targetDest = this.patrolPoints[1];
  }
  findTarget() { this.target = player; }
  update() {
    super.update();
    if (this.state === STATE.PATROL) {
      const distFromTarget = distance(this.pos, this.targetDest);
      const targetAngle = angleRadians(this.pos, this.targetDest);
      const A = Math.floor(this.angle * 3)
      const B = Math.floor(targetAngle * 3)
      if (A === B) {
        this.angle = targetAngle;//Math.floor(targetAngle * 100) / 100 + .05;
        this.moveDirection = 1;
        this.rotateDirection = 0;
      }
      else if (this.moveDirection !== 0) {
        this.rotateDirection = this.angle > targetAngle ? 1 : -1;
        const { patrolPoints, targetDest } = this;
        if (distance(this.pos, this.targetDest) < 100) {
          this.targetDest = patrolPoints[patrolPoints.findIndex(p => p.equals(this.targetDest)) + 1 % patrolPoints.length ];
          // const newTargetAngle = angleRadians(this.pos, this.targetDest);
          // this.moveDirection = 0;
        }
      }
      if (distFromTarget <= PLAYER_DETECT_RANGE) {
        this.state = STATE.ATTACK;
      }
    }
  }
}
