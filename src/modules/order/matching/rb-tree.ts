enum Color {
  RED,
  BLACK,
}

class Node<T> {
  data: T;
  color: Color;
  left: Node<T> | null;
  right: Node<T> | null;
  parent: Node<T> | null;

  constructor(data: T) {
    this.data = data;
    this.color = Color.RED;
    this.left = null;
    this.right = null;
    this.parent = null;
  }
}

export class RBTree<T> {
  private root: Node<T> | null;
  private readonly compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.root = null;
    this.compare = compare;
  }

  insert(data: T): void {
    let node = new Node(data);

    if (this.root === null) {
      node.color = Color.BLACK;
      this.root = node;
      return;
    }

    let current = this.root;
    let parent: Node<T> | null = null;

    while (current !== null) {
      parent = current;
      if (this.compare(data, current.data) < 0) {
        current = current.left;
      } else {
        current = current.right;
      }
    }

    node.parent = parent;
    if (this.compare(data, parent!.data) < 0) {
      parent!.left = node;
    } else {
      parent!.right = node;
    }

    this.fixInsert(node);
  }

  private fixInsert(node: Node<T>): void {
    while (node !== this.root && node.parent!.color === Color.RED) {
      if (node.parent === node.parent!.parent!.left) {
        let uncle = node.parent!.parent!.right;

        if (uncle !== null && uncle.color === Color.RED) {
          node.parent!.color = Color.BLACK;
          uncle.color = Color.BLACK;
          node.parent!.parent!.color = Color.RED;
          node = node.parent!.parent!;
        } else {
          if (node === node.parent!.right) {
            node = node.parent!;
            this.leftRotate(node);
          }
          node.parent!.color = Color.BLACK;
          node.parent!.parent!.color = Color.RED;
          this.rightRotate(node.parent!.parent!);
        }
      } else {
        let uncle = node.parent!.parent!.left;

        if (uncle !== null && uncle.color === Color.RED) {
          node.parent!.color = Color.BLACK;
          uncle.color = Color.BLACK;
          node.parent!.parent!.color = Color.RED;
          node = node.parent!.parent!;
        } else {
          if (node === node.parent!.left) {
            node = node.parent!;
            this.rightRotate(node);
          }
          node.parent!.color = Color.BLACK;
          node.parent!.parent!.color = Color.RED;
          this.leftRotate(node.parent!.parent!);
        }
      }
    }
    this.root!.color = Color.BLACK;
  }

  remove(data: T): boolean {
    let node = this.findNode(data);
    if (node === null) {
      return false;
    }

    let y = node;
    let yOriginalColor = y.color;
    let x: Node<T> | null;

    if (node.left === null) {
      x = node.right;
      this.transplant(node, node.right);
    } else if (node.right === null) {
      x = node.left;
      this.transplant(node, node.left);
    } else {
      y = this.minimum(node.right);
      yOriginalColor = y.color;
      x = y.right;

      if (y.parent === node) {
        if (x !== null) {
          x.parent = y;
        }
      } else {
        this.transplant(y, y.right);
        y.right = node.right;
        y.right!.parent = y;
      }

      this.transplant(node, y);
      y.left = node.left;
      y.left!.parent = y;
      y.color = node.color;
    }

    if (yOriginalColor === Color.BLACK) {
      this.fixDelete(x);
    }

    return true;
  }

  private fixDelete(node: Node<T> | null): void {
    while (node !== this.root && node?.color === Color.BLACK) {
      if (node === node!.parent!.left) {
        let w = node!.parent!.right;

        if (w!.color === Color.RED) {
          w!.color = Color.BLACK;
          node!.parent!.color = Color.RED;
          this.leftRotate(node!.parent!);
          w = node!.parent!.right;
        }

        if (w!.left!.color === Color.BLACK && w!.right!.color === Color.BLACK) {
          w!.color = Color.RED;
          node = node!.parent!;
        } else {
          if (w!.right!.color === Color.BLACK) {
            w!.left!.color = Color.BLACK;
            w!.color = Color.RED;
            this.rightRotate(w!);
            w = node!.parent!.right;
          }

          w!.color = node!.parent!.color;
          node!.parent!.color = Color.BLACK;
          w!.right!.color = Color.BLACK;
          this.leftRotate(node!.parent!);
          node = this.root;
        }
      } else {
        let w = node!.parent!.left;

        if (w!.color === Color.RED) {
          w!.color = Color.BLACK;
          node!.parent!.color = Color.RED;
          this.rightRotate(node!.parent!);
          w = node!.parent!.left;
        }

        if (w!.right!.color === Color.BLACK && w!.left!.color === Color.BLACK) {
          w!.color = Color.RED;
          node = node!.parent!;
        } else {
          if (w!.left!.color === Color.BLACK) {
            w!.right!.color = Color.BLACK;
            w!.color = Color.RED;
            this.leftRotate(w!);
            w = node!.parent!.left;
          }

          w!.color = node!.parent!.color;
          node!.parent!.color = Color.BLACK;
          w!.left!.color = Color.BLACK;
          this.rightRotate(node!.parent!);
          node = this.root;
        }
      }
    }
    if (node !== null) {
      node.color = Color.BLACK;
    }
  }

  private findNode(data: T): Node<T> | null {
    let current = this.root;
    while (current !== null) {
      const comparison = this.compare(data, current.data);
      if (comparison === 0) {
        return current;
      }
      current = comparison < 0 ? current.left : current.right;
    }
    return null;
  }

  private minimum(node: Node<T>): Node<T> {
    let current = node;
    while (current.left !== null) {
      current = current.left;
    }
    return current;
  }

  private transplant(u: Node<T>, v: Node<T> | null): void {
    if (u.parent === null) {
      this.root = v;
    } else if (u === u.parent.left) {
      u.parent.left = v;
    } else {
      u.parent.right = v;
    }
    if (v !== null) {
      v.parent = u.parent;
    }
  }

  private leftRotate(node: Node<T>): void {
    let y = node.right!;
    node.right = y.left;

    if (y.left !== null) {
      y.left.parent = node;
    }

    y.parent = node.parent;

    if (node.parent === null) {
      this.root = y;
    } else if (node === node.parent.left) {
      node.parent.left = y;
    } else {
      node.parent.right = y;
    }

    y.left = node;
    node.parent = y;
  }

  private rightRotate(node: Node<T>): void {
    let x = node.left!;
    node.left = x.right;

    if (x.right !== null) {
      x.right.parent = node;
    }

    x.parent = node.parent;

    if (node.parent === null) {
      this.root = x;
    } else if (node === node.parent.right) {
      node.parent.right = x;
    } else {
      node.parent.left = x;
    }

    x.right = node;
    node.parent = x;
  }

  min(): T | null {
    if (this.root === null) {
      return null;
    }
    return this.minimum(this.root).data;
  }

  max(): T | null {
    if (this.root === null) {
      return null;
    }
    let current = this.root;
    while (current.right !== null) {
      current = current.right;
    }
    return current.data;
  }

  next(data: T): T | null {
    let current = this.root;
    let successor: Node<T> | null = null;

    while (current !== null) {
      if (this.compare(data, current.data) < 0) {
        successor = current;
        current = current.left;
      } else {
        current = current.right;
      }
    }

    return successor?.data ?? null;
  }

  prev(data: T): T | null {
    let current = this.root;
    let predecessor: Node<T> | null = null;

    while (current !== null) {
      if (this.compare(data, current.data) > 0) {
        predecessor = current;
        current = current.right;
      } else {
        current = current.left;
      }
    }

    return predecessor?.data ?? null;
  }

  clear(): void {
    this.root = null;
  }
}
