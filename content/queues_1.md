---
concept_id: queues_1
source_title: Queues
page: 6
---

# Queues

A queue is another linear data structure, but it follows a different order than a stack. A queue operates on the First-In, First-Out (FIFO) principle.

### The FIFO Principle

Think of a queue like a line of people waiting for a movie ticket. The first person to join the line is the first person to get a ticket and leave the line. People join at the back and leave from the front.

### Enqueue and Dequeue

The two main operations for a queue are Enqueue and Dequeue. "Enqueue" means adding an item to the back (or tail) of the queue. "Dequeue" means removing an item from the front (or head) of the queue. Just like with a stack, trying to dequeue from an empty queue is an error.

### Applications

Queues are commonly used when tasks need to be processed in the exact order they arrive. For example, a printer uses a queue to print documents in the order they were submitted. Operating systems use queues to schedule which programs get access to the CPU.
