---
concept_id: linked_lists_1
source_title: Singly Linked Lists
page: 3
---

# Singly Linked Lists

A linked list is a sequence of data elements, where each element points to the next one. Unlike arrays, linked lists do not store elements in contiguous memory locations. Instead, the elements can be scattered anywhere in memory.

### Nodes

Each element in a linked list is called a node. A node contains two parts: the actual data you want to store, and a reference (or pointer) to the next node in the sequence. 

### The Head and Tail

The first node in a linked list is called the head. If the list is empty, the head points to nothing (null). The last node in the list has a pointer that points to null, signifying the end of the chain. To find any element, you must start at the head and follow the pointers one by one until you reach your destination.

### Flexibility

Because nodes are linked by pointers, inserting or deleting an element is as simple as changing a couple of pointers. You don't need to shift any other elements, making insertions and deletions very fast compared to arrays, provided you already know the location of the node.
