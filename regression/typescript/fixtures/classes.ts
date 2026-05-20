export class Animal {
  constructor(public name: string) {}

  speak(): string {
    return `${this.name} makes a sound`;
  }
}

export class Dog extends Animal {
  breed: string;

  constructor(name: string, breed: string) {
    super(name);
    this.breed = breed;
  }

  speak(): string {
    return `${this.name} barks`;
  }
}

export interface Printable {
  print(): string;
}

export class Document implements Printable {
  constructor(public title: string) {}

  print(): string {
    return `Document: ${this.title}`;
  }
}
