class GameObject {
  constructor({pos, size, angle = 0, center, color = "gray", moveSpeed, rotateSpeed, isSolid, team=NO_COLLISION, hp = 1, isImmovable, canDie}) {
    this.pos = pos;
    this.gridPos = getGridPos(pos);
    this.size = size;
    this.angle = angle;
    this.center = center || size.scale(.5);
    this.color = color;
    this.moveSpeed = moveSpeed || new Speed;
    this.rotateSpeed = rotateSpeed || new Speed;
    this.isSolid = isSolid;
    this.team = team; // 0=Neutral, 1=Friendly, 2=Enemy, 3=Environment
    this.hp = hp;
    this.lastFlash = null;
    this.isDead = false;
    this.isImmovable = isImmovable;
    this.canDie = canDie;
    objList.push(this);
  }

  move(direction) { this.moveSpeed.move(direction); }
  rotate(direction) { this.rotateSpeed.move(direction); }

  update() {
    const { moveSpeed, pos, size, angle, rotateSpeed, canDie, hp, isDead } = this;
    if (moveSpeed.speed !== 0)
      this.pos = pos.move(angle, moveSpeed.speed * tDiff);
    if (rotateSpeed.speed !== 0) {
      const newAngle = (angle + rotateSpeed.speed * tDiff);
      this.angle = newAngle >= 0 ? (newAngle % PI2) : (PI2 + newAngle);
    }
    this.gridPos = getGridPos(pos);
    if (canDie && hp <= 0 && !isDead) {
      new Explosion({pos: this.pos.copy(), size: size.scale(2), timeLen: 2, team: NO_COLLISION});
      this.moveDirection = 0;
      this.rotateDirection = 0;
      this.isDead = true;
      this.isFiring = false;
      this.team = NO_COLLISION;
    }
  }
  collidedWith(obj) {
    DEBUG_COLLISIONS.push(`${this.constructor.name} collidedWith ${obj.constructor.name}`);
  }
  render() {
    const { pos, size, angle, center, color } = this;
    rect(pos, size, angle, center, color);
  }
  toString() { return `pos,gridPos,size,angle,center,color,moveSpeed,rotateSpeed`.split`,`.map(n=>`${n}: ${formatNum(this[n])}`); }
}
