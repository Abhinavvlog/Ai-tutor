---
concept_id: linked_lists_2
source_title: Doubly Linked Lists
page: 4
---

# Doubly Linked Lists

A doubly linked list is an extension of the singly linked list. While a singly linked list only allows you to traverse forward, a doubly linked list allows traversal in both directions.

### The Previous Pointer

In a doubly linked list, each node contains three parts: the data, a pointer to the next node, and a new pointer that references the previous node. The previous pointer of the head node is set to null, and the next pointer of the tail node is set to null.

### Advantages

The main advantage is flexibility. If you are at a specific node, you can easily look at the element just before it without having to start over from the head. This makes certain operations, like deleting a node when you only have a reference to that node, much easier and faster.

### Memory Overhead

The trade-off for this flexibility is memory. Because every node now has an extra pointer, a doubly linked list takes up more memory than a singly linked list. Additionally, every time you insert or delete a node, you have to carefully update more pointers to keep the list intact.
