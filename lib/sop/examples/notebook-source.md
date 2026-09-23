# Multi-Class Classification: Teaching a Machine to Choose Among Several Options

## Agenda

- Understand why a single-output classifier is not enough when there are more than two categories to choose from
- Learn the notation used to describe a small neural network: inputs, weights, bias, neurons, and outputs
- Extend a single classifier into a multi-output network and understand how the computation is vectorized
- Understand why the softmax function is the natural extension of the sigmoid function to multiple classes
- Derive Categorical Cross-Entropy as the loss function used for multi-class problems
- Walk through the full training loop of a neural network: forward propagation, loss calculation, and backward propagation
- Build an intuitive understanding of the chain rule that powers backpropagation
- See how these exact ideas show up in modern AI systems, including large language models

## Setting the Scene: GreenSort

Picture a small recycling facility that has just installed a robotic sorting arm, which we will call **GreenSort**. Every item that comes down the conveyor belt has to be dropped into one of three bins: **Paper**, **Plastic**, or **Metal**.

GreenSort does not "see" the item directly. Instead, it reads two numbers from a sensor pod above the belt for every item $i$:

- $x_{i1}$: the weight of the item, in grams
- $x_{i2}$: a reflectivity score of the item's surface, between 0 and 1

Our job today is to design and train the small neural network that sits inside GreenSort's controller, so that given $x_{i1}$ and $x_{i2}$, it can decide which of the three bins the item belongs to. We will keep returning to GreenSort as we introduce each new idea, so that the mathematics always has a concrete home to live in.

---
## Section 1: From One Decision to Many

GreenSort's engineers already know how to build a classifier that makes a single yes/no decision. That is exactly what Logistic Regression does: one neuron, one output, and a sigmoid function squashing that output into a value between 0 and 1, read as a probability.

**Question:** Can a single Logistic Regression neuron decide between Paper, Plastic, and Metal directly?

**Answer:** No. A single neuron with a sigmoid output can only answer a yes/no style question, such as "is this item Plastic or not." It cannot, by itself, choose among three mutually exclusive categories.

**Question:** So how do we modify our approach?

We use one output neuron for each class. These neurons produce three raw scores together, which softmax converts into a single probability distribution across the classes.. Each neuron becomes a specialist that produces a raw score for its own category, based on the same two sensor readings. Three specialists, one per bin, working side by side.

A model built out of multiple neurons working together like this is called a **Neural Network (NN)**. Even this small three-neuron setup, with no hidden layers, already qualifies as one.

Here is a simple flow of what we are building, drawn as a diagram in text since we are not using images in this session:

```
                    +--------> f_Paper   (neuron 1)  --> a_1
                    |
 Sensors (x1, x2) --+--------> f_Plastic (neuron 2)  --> a_2
                    |
                    +--------> f_Metal   (neuron 3)  --> a_3
```

Each of the two sensor readings is sent to all three neurons. Each neuron produces its own output, based on its own weights and bias.

### Notation

Before we go further, let's fix a common language, because the same few symbols will be reused throughout the class.

- **Inputs**: for a single item $i$, we have two sensor readings, $x_{i1}$ and $x_{i2}$. When we have $m$ items on the belt at once, we stack them into a matrix $X$ of shape $m \times d$, where $d = 2$ is the number of features (here, weight and reflectivity), and every row of $X$ is one item.

- **Neuron**: we write a neuron as $f_j$, where $j$ identifies which neuron we mean. For example, $f_1$ could be the Paper-detecting neuron.

- **Weight**: a weight is written $w_{ij}$, where $i$ identifies the source feature and $j$ identifies the destination neuron. So $w_{12}$ is the weight connecting feature $x_{i1}$ (weight of the item) to neuron $f_2$ (the Plastic detector).

- **Bias**: every neuron has its own bias term $b_j$, one per neuron, independent of the input.

- **z-value**: $z_j$ is the raw, linear score produced by neuron $j$, before any squashing function is applied. For our two-feature setup: $z_j = w_{1j} \cdot x_{i1} + w_{2j} \cdot x_{i2} + b_j$.

- **Output / activation**: $a_j$ is what neuron $j$ outputs after applying an activation function to $z_j$. Later in this class, that activation function will be softmax.

We now have a name for every piece of GreenSort's three-neuron setup, and we know how to compute one $z_j$ at a time, one item at a time. But GreenSort is meant to sort hundreds of items a minute, each with its own $x_{i1}$ and $x_{i2}$. Writing three separate equations for $z_1$, $z_2$, $z_3$, and repeating that for every single item on the belt, will not scale. This is precisely the problem that pushes us toward the next step: packing this entire computation into matrices, so that all items and all neurons are handled in one shot.

### Quiz 1

GreenSort has 2 sensor readings and needs to sort items into 3 bins.

How many weight parameters ($w$) will the network need in total, excluding biases?

- **A.** 2
- **B.** 3
- **C.** 6
- **D.** 9

**Correct Answer: C. 6**

**Explanation:** Each of the 2 features connects to each of the 3 neurons, giving $2 \times 3 = 6$ weights: $w_{11}, w_{12}, w_{13}, w_{21}, w_{22}, w_{23}$. Each neuron additionally has its own bias, but the question only asked about weights.

---
## Section 2: Packing the Network Into Matrices

Writing $z_j = w_{1j} \cdot x_{i1} + w_{2j} \cdot x_{i2} + b_j$ separately for every neuron and every item would get unwieldy very quickly once GreenSort is processing hundreds of items a minute. We vectorize the computation instead.

Instead of a single weight vector, as we would have had for one neuron, we now arrange all the weights into a **weight matrix** $W$, of shape $d \times n$, where $d$ is the number of input features and $n$ is the number of output neurons (here, $n = 3$, one per bin). Column $j$ of $W$ holds all the weights feeding into neuron $j$.

Think of $W$ as a control panel: $d$ input dials on one side, $n$ output readouts on the other, and every dial connected to every readout through its own adjustable knob, which is exactly one weight.

With this setup, the entire batch of raw scores for all $m$ items and all $n$ neurons can be computed in a single matrix operation:

$$Z = XW + b$$

- $X$ has shape $m \times d$: $m$ items, $d$ features each.
- $W$ has shape $d \times n$: $d$ input features feeding into $n$ neurons.
- $b$ has shape $1 \times n$, one bias per neuron, and is added to every row of $XW$.
- $Z$ has shape $m \times n$: one raw score per item, per neuron.

### Quiz 2

If X has shape 12 × 2 and W has shape 2 × 3, what is the shape of Z = XW + b?

- **A.** 2 × 3
- **B.** 12 × 3
- **C.** 12 × 2
- **D.** 3 × 12

**Correct Answer: B. 12 × 3**

**Explanation:** Matrix multiplication of an (m × d) matrix with a (d × n) matrix produces an (m × n) matrix. Here, m = 12 items and n = 3 neurons, so Z has shape 12 × 3: one raw score per item for each of the 3 bins. Adding the bias b does not change this shape, since it is broadcast across all 12 rows.

This single equation, $Z = XW + b$, is worth remembering carefully. It is not just specific to GreenSort's three bins. This is the same core computation that sits inside every layer of most modern neural networks, including the very large ones used in image recognition and language models, just with far larger values of $d$ and $n$.

GreenSort can now compute all three raw scores, $z_{\text{Paper}}$, $z_{\text{Plastic}}$, $z_{\text{Metal}}$, for an entire batch of items in one matrix operation. But notice that a raw score is still just a plain real number: it could be 3.2, or -1.7, or 0. Nothing about it yet forces GreenSort to make one clear, consistent choice among the three bins, and nothing stops all three scores from looking equally plausible, or equally implausible. Producing a raw number is not the same as making a decision. That gap, turning three unconstrained numbers into one confident, consistent choice, is exactly what we solve next.

---
## Section 3: From Raw Scores to a Fair Vote

We now have three raw scores per item, $z_1$, $z_2$, and $z_3$, one from each neuron. The natural instinct is to squash each of them independently with a sigmoid function, the same way we did for a single yes/no decision.

**Question:** What goes wrong if we apply sigmoid independently to each $z_j$?

Suppose GreenSort's three sigmoid outputs come out as 0.7, 0.6, and 0.1. Two of these are above 0.5. Does that mean the item is both Paper and Plastic at once? That cannot be right, since every item goes into exactly one bin. Independent sigmoids also do not guarantee the three numbers add up to 1, so they cannot be read as a single probability distribution over three exclusive outcomes.

We need a function that takes in $z_1, z_2, z_3$ and returns three numbers that are all non-negative and sum to exactly 1. That function is called **softmax**.

### The Softmax Function

$$p_j = \frac{e^{z_j}}{\sum_{k=1}^{n} e^{z_k}}$$

Here $p_j$ is the probability assigned to class $j$ (in our case, $j$ is Paper, Plastic, or Metal), $z_j$ is that class's raw score, and the denominator sums $e^{z_k}$ over all $n$ classes so that the results add up to 1.

**Question:** Why raise $z$ to the power of $e$, rather than simply dividing each $z_j$ by the sum of all the $z$ values?

Raw scores $z_j$ can be negative, since they come from a plain linear combination of inputs and weights. A probability cannot be negative, so we first need every value to become positive. Exponentiating does exactly that: $e^{z}$ is always positive, however negative $z$ is. It also has a useful side effect: think of it as a confidence amplifier. If GreenSort's Metal neuron produces a noticeably larger raw score than the other two, exponentiation stretches that gap further, so the final probability for Metal grows disproportionately more, giving the network a way to express strong confidence rather than only a mild preference.

Once every score is positive, dividing each one by the total simply rescales the three numbers so that they add up to exactly 1.
We interpret these normalized outputs as the model's predicted probabilities. Whether those probabilities are well calibrated is a separate question.

### Quiz 3

GreenSort's three neurons output raw scores z_Paper = 2, z_Plastic = 1, z_Metal = 0.

Which bin will receive the highest softmax probability?

- **A.** Paper
- **B.** Plastic
- **C.** Metal
- **D.** All three will be exactly equal

**Correct Answer: A. Paper**

**Explanation:** Softmax is a monotonic function of the raw scores: the larger the input z, the larger the resulting probability. Since z_Paper = 2 is the largest of the three scores, Paper receives the largest probability once the scores are exponentiated and normalized, even without computing the exact numbers.

### Interactive playground

```python
# Interactive Playground: Watching Softmax Redistribute Confidence
# Move the three sliders to change the raw scores (z) for Paper, Plastic, and Metal
# and observe how the resulting probabilities always stay non-negative and sum to 1.

import numpy as np
import matplotlib.pyplot as plt
from ipywidgets import interact, FloatSlider

labels = ["Paper", "Plastic", "Metal"]

def softmax(z):
    exp_z = np.exp(z - np.max(z))  # shift for numerical stability, does not change the result
    return exp_z / np.sum(exp_z)

def plot_softmax(z_paper=1.0, z_plastic=1.0, z_metal=1.0):
    z = np.array([z_paper, z_plastic, z_metal])
    p = softmax(z)

    fig, axes = plt.subplots(1, 2, figsize=(10, 4))

    axes[0].bar(labels, z, color="gray")
    axes[0].set_title("Raw scores (z)")
    axes[0].set_ylim(-5, 5)
    axes[0].axhline(0, color="black", linewidth=0.8)

    axes[1].bar(labels, p, color="steelblue")
    axes[1].set_title("Softmax probabilities (p)")
    axes[1].set_ylim(0, 1)
    for idx, val in enumerate(p):
        axes[1].text(idx, val + 0.02, f"{val:.2f}", ha="center")

    plt.tight_layout()
    plt.show()
    print(f"Sum of probabilities: {p.sum():.4f}")

interact(
    plot_softmax,
    z_paper=FloatSlider(min=-5, max=5, step=0.1, value=1.0, description="z_Paper"),
    z_plastic=FloatSlider(min=-5, max=5, step=0.1, value=1.0, description="z_Plastic"),
    z_metal=FloatSlider(min=-5, max=5, step=0.1, value=1.0, description="z_Metal"),
)
```

Output:
```text
interactive(children=(FloatSlider(value=1.0, description='z_Paper', max=5.0, min=-5.0), FloatSlider(value=1.0,…
```

Output:
```text
<function __main__.plot_softmax(z_paper=1.0, z_plastic=1.0, z_metal=1.0)>
```

**Ask AI:** Ask an AI assistant to explain the connection between the softmax function and the Boltzmann distribution used in statistical physics to describe the probability of a system occupying different energy states. Write down, in your own words, what the raw score $z$ corresponds to in that physical analogy.

GreenSort can now turn its raw scores into three confident-looking probabilities, say 0.7 for Plastic, 0.2 for Paper, and 0.1 for Metal. But right now, $W$ and $b$ are still just the small random numbers we started with. GreenSort has no reason yet to believe these particular probabilities are any good, and no way of knowing whether this specific guess was right or badly wrong. Producing a probability is not the same as learning. Before GreenSort's weights can improve, its engineers need one more ingredient: a precise, numerical way to score exactly how wrong a given guess was, so that "wrong" becomes something a machine can react to. That is the problem we turn to next.

---
## Section 4: Measuring How Wrong GreenSort Was

GreenSort now produces a probability for each bin. To train it, we need a way to measure how wrong those probabilities were compared to the item's actual, correct bin, so that the network can be nudged toward better predictions.

**Question:** What loss function did we use for a single yes/no decision, back in Logistic Regression?

We used **log loss**, defined for a single item as:

$$\text{Log-loss}_i = -\big[y_i \cdot \log(\hat{y}_i) + (1 - y_i) \cdot \log(1 - \hat{y}_i)\big]$$

where $y_i$ is the true label (0 or 1) and $\hat{y}_i$ is the predicted probability of the positive class.

**Question:** Can we reuse this same log loss directly for our three-bin problem?

No. Log loss is written specifically for two outcomes, since $\hat{y}_i$ there represents the probability of belonging to exactly one class, with the other probability inferred as $1 - \hat{y}_i$. With three bins, we need a loss that can handle all $n$ classes at once.

### Building Categorical Cross-Entropy

First, we need a way to represent the true bin of an item numerically. We use **one-hot encoding**: if item $i$ truly belongs to class $j$, then $y_{ij} = 1$ and $y_{ik} = 0$ for every other class $k$. For example, if an item is truly Plastic (say, class 2 out of Paper, Plastic, Metal), then $y_i = [0, 1, 0]$.

The **Categorical Cross-Entropy** for item $i$, across $k$ total classes, is then defined as:

$$CE_i = -\sum_{j=1}^{k} y_{ij} \log(p_{ij})$$

where $p_{ij}$ is the predicted probability, from softmax, that item $i$ belongs to class $j$.

Notice what happens because of one-hot encoding: since $y_{ij} = 0$ for every class except the true one, every term in that sum vanishes except the term for the true class. So the formula quietly collapses down to:

$$CE_i = -\log(p_{i,\text{true class}})$$

In other words, we only ever look at the probability the network assigned to the *correct* bin, and penalize it for being small. If GreenSort was highly confident and correct, $p$ is close to 1, and $-\log(p)$ is close to 0, a very small penalty. If GreenSort was confident but wrong, $p$ for the true class is close to 0, and $-\log(p)$ grows very large, a steep penalty.

**Question:** What happens to Categorical Cross-Entropy when there are exactly $k = 2$ classes?

With two classes, class 1 and class 2, the formula becomes:

$$CE_i = -\big[y_{i1}\log(p_{i1}) + y_{i2}\log(p_{i2})\big]$$

which, once you substitute $y_{i2} = 1 - y_{i1}$ and $p_{i2} = 1 - p_{i1}$, is algebraically identical to the log loss we already knew from Logistic Regression. Log loss is, in fact, also known as **Binary Cross-Entropy**, the two-class special case of the more general formula we just derived.

### Quiz 4

An item is truly Plastic, so y = [0, 1, 0].

GreenSort predicts probabilities p = [0.2, 0.5, 0.3].

What is the Categorical Cross-Entropy loss for this single item?

- **A.** -log(0.2)
- **B.** -log(0.5)
- **C.** -log(0.3)
- **D.** -log(0.2) - log(0.5) - log(0.3)

**Correct Answer: B. -log(0.5)**

**Explanation:** Because of one-hot encoding, every term in the sum is multiplied by either 0 or 1. Only the term for the true class, Plastic, survives, since y_Plastic = 1 and the other y values are 0. So the loss is simply -log(p_Plastic) = -log(0.5).

---
## AI Spotlight: From Sorting Recyclables to Powering Language Models

Everything we have built so far, a linear score $Z = XW + b$, followed by softmax, followed by Categorical Cross-Entropy, is not a toy setup invented only for a three-bin recycling problem. It is, almost unchanged, the standard final stage of nearly every modern classification neural network.

A few places this exact combination shows up:

- Image classification networks use it to choose among hundreds or thousands of object categories, instead of GreenSort's three bins.
- Large language models use it at every single step of generating text: instead of 3 output neurons, there is one neuron for every possible next word or sub-word token, often more than 100,000 of them. The network computes a raw score for every possible token, applies softmax to turn those scores into a probability distribution over the entire vocabulary, and is trained using the very same cross-entropy loss to make the probability of the actual next token as high as possible.
- Recommendation systems use it to choose among a large catalog of items to suggest next.

The scale is enormously larger, and there are many more layers involved before this final stage, but the mathematics you have derived today, from the shape of $Z$, to why softmax needs an exponential, to why cross-entropy collapses to $-\log(p)$ for the true class, is exactly the mathematics sitting underneath these systems.

**Ask AI:** Ask an AI assistant to compare the three-class softmax we used for GreenSort to the vocabulary-sized softmax used at the output of a language model. Specifically, ask how the computation cost changes as the number of classes grows from 3 to over 100,000, and why techniques such as hierarchical softmax or sampling-based losses were developed to address that cost.

Let's come back to GreenSort itself. At this point, we can compute a probability for every bin, and we can compute a single number, the loss $J$, that tells us exactly how wrong that probability was for a given item. That is real progress, but on its own it only tells the engineers *that* GreenSort was wrong, not *which* weight caused the mistake, or by how much, or in which direction it should change. Knowing the loss does not, by itself, fix a single number inside $W$ or $b$. To actually improve GreenSort, we need one last piece: an algorithm that takes this one loss value and works backward through the network to tell every individual weight and bias exactly how to change. That algorithm is the training loop we build next.

---
## Section 5: Teaching GreenSort From Its Mistakes

We now have every ingredient needed to train GreenSort's network: a way to compute probabilities (softmax), and a way to measure how wrong those probabilities were (Categorical Cross-Entropy). Training the network with gradient descent follows the same overall loop we used for a single Logistic Regression neuron:

1. Initialize the parameters $W$ and $b$, typically with small random values.
2. **Forward propagation**: use the current $W$ and $b$ to compute $Z$, then softmax, to get predicted probabilities.
3. Calculate the loss, using Categorical Cross-Entropy, to see how wrong those probabilities were.
4. **Backward propagation**: figure out how much each individual weight and bias contributed to that loss.
5. Update every weight and bias slightly, in the direction that reduces the loss.

Steps 2 through 5 are repeated many times, with GreenSort's predictions improving a little more on every pass.

You can think of this loop the way a chef refines a recipe: taste the dish (forward propagation), decide how far it is from what was intended (loss), work out which specific ingredient caused the problem and by how much (backward propagation), then adjust that ingredient's quantity slightly (update), and taste again.

### Forward Propagation, Revisited

For a batch of items on the belt, forward propagation for GreenSort is simply:

1. Compute the raw scores: $Z = XW + b$
2. Apply softmax to $Z$, row by row, to get predicted probabilities $P$
3. Compare $P$ against the true one-hot labels $Y$ using Categorical Cross-Entropy, to obtain the overall loss $J$

We can draw this as a computational graph, a diagram of each stage feeding into the next, again in plain text:

```
X, W, b  --->  Z = XW + b  --->  P = softmax(Z)  --->  J = CrossEntropy(P, Y)
```

Every arrow in this diagram represents a step we already know how to compute going forward. Forward propagation gets us as far as the single number $J$, the loss. But $J$ alone does not tell the engineers how to change $W$ or $b$. Since $W$ and $b$ sit at the very start of this diagram and $J$ sits at the very end, we need a way to relate a change at the start to its effect at the end. That is exactly what backward propagation does: it traces this same diagram in reverse.

### Backward Propagation: Assigning Blame

**Question:** How did we reduce the loss in Logistic Regression?

We computed the partial derivative of the loss $J$ with respect to each weight and bias, which tells us how much a small change in that particular parameter would change $J$, and then updated every parameter a small step in the direction that decreases $J$.

For GreenSort's network, the loss $J$ does not depend on a weight $w$ directly. It depends on $w$ only through a chain: $w$ affects $z$, $z$ affects $p$ (through softmax), and $p$ affects $J$ (through cross-entropy). This is exactly the computational graph we drew above, just read in reverse.

Think of a relay race with three runners, where only the final finishing time is announced. If you want to know how much the first runner's speed affected that final time, you cannot look at the finish line alone. You have to trace backward through every handoff: how the first runner's speed affected the second runner's start, how that affected the third runner's start, and finally how that affected the finishing time. Backward propagation performs exactly this kind of backward tracing, using the **chain rule** from calculus.

Formally, for our computational graph $X, W, b \to Z \to P \to J$, the chain rule gives us:

$$\frac{\partial J}{\partial w} = \frac{\partial J}{\partial p} \cdot \frac{\partial p}{\partial z} \cdot \frac{\partial z}{\partial w}$$

Reading this from right to left: $\dfrac{\partial z}{\partial w}$ tells us how a change in a weight changes the raw score $z$; $\dfrac{\partial p}{\partial z}$ tells us how that change in $z$ changes the softmax probability $p$; and $\dfrac{\partial J}{\partial p}$ tells us how that change in $p$ changes the final loss $J$. Multiplying these three effects together, link by link along the chain, tells us exactly how much a small nudge to $w$ ultimately moves the loss $J$, which is precisely the information gradient descent needs to update $w$ in the right direction.

### Quiz 5

In the computational graph X, W, b → Z → P → J, which quantity does backward propagation compute first, before it can compute anything else?

- **A.** The updated value of W
- **B.** How J changes with respect to P, i.e. dJ/dP
- **C.** The value of X
- **D.** The learning rate

**Correct Answer: B. How J changes with respect to P, i.e. dJ/dP**

**Explanation:** Backward propagation traces the computational graph in reverse, starting from the loss J and working backward. The very first quantity available is how J changes with respect to the node immediately before it, P, since J was computed directly from P. Every earlier partial derivative, including the one for W, is obtained by multiplying this term with further terms further back along the chain.

**Ask AI:** Ask an AI assistant to derive $\dfrac{\partial J}{\partial z}$ in full for the specific combination of softmax and Categorical Cross-Entropy, and to confirm that it simplifies neatly to $p - y$. Compare that clean, worked-out derivation with the conceptual, link-by-link chain rule explanation from this class, and note down any step you find surprising.

### Interactive playground
Visualise Forward and backward propagation

```python
from IPython.display import IFrame, display

url = "https://shrijankumar1-maker.github.io/NN-visualiser/"

display(
    IFrame(
        src=url,
        width="100%",
        height=1000
    )
)
```

Output:
```text
<IPython.lib.display.IFrame at 0x7a6d4bf9fe10>
```

---
## Wrap-Up

Over this session, GreenSort's sorting arm went from being unable to make a three-way decision at all, to having a fully specified, trainable neural network. Specifically, we:

- Saw why a single Logistic Regression neuron cannot handle more than two exclusive classes, and why we instead use one neuron per class
- Established a shared notation for inputs, weights, bias, neurons, raw scores, and activations
- Packed the whole multi-neuron computation into a single vectorized equation, $Z = XW + b$
- Derived the softmax function as the natural way to turn several raw scores into a valid probability distribution, and understood why the exponential is essential to it
- Generalized log loss into Categorical Cross-Entropy, and saw that it reduces to $-\log$ of the predicted probability for the true class
- Walked through the full training loop: forward propagation, loss calculation, backward propagation, and parameter updates
- Built an intuitive picture of the chain rule as backward tracing through a computational graph, using a relay race analogy
- Connected all of this directly to how modern large-scale AI systems, including language models, are trained

The same five-step loop you now understand for GreenSort's three bins is, at its core, the loop used to train some of the largest neural networks in existence today, just repeated many more times, over many more layers, with many more classes.
