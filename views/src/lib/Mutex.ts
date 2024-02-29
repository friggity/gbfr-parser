class Mutex {
  private locked: boolean = false;
  private i: number = 0;

  async lock() {
    this.i++;
    if (this.locked) {
      await new Promise<void>(resolve => {
        const interval = setInterval(() => {
          if (!this.locked) {
            clearInterval(interval);
            resolve();
          }
        }, 100 + this.i);
      });
    }
    this.locked = true;
  }

  unlock() {
    this.locked = false;
  }

  async wrap(fn: Function) {
    await this.lock();
    await fn();
    this.unlock();
  }
}

export default Mutex;
