---
title: "what the hale!?"
kind: article
authorship: human
date: 2026-09-02
summary: >-
  Why build a new language in 2026. A locus owns state and talks over declared
  topics, and that one restriction turns out to carry most of what code review
  was for: the architecture stops living in docs and heads and becomes the only
  sentence the language accepts — from a value, to a binary, to a fleet.
---

## intro

it's 2026: language models are dominating the software space in more ways than one. as a developer, you either love it or you hate it. you're probably using a programming language that was built for humans; go, rust, c(pp|#|etc), java, yada yada yada, everyone's got their favorite. it's 2026, the models are good, you're probably not too concerned with the results of any given turn. you split your time between managing the cohesion of the system across complex changes, and thinking about what comes next.

languages, programming or otherwise, do a few things all at once. by virtue of how a language is structured, and how each individual word fits into that structure, the possibility space of the next word is always further constrained, with each added word (that was wordy!). the structure of a language is a tessellated pattern of motion, and each language's structure is different. some structures are harder to learn than others, some easier. "knowing a language" is the internal operationalization of the language's structure, hydrated by vocabulary, helped by recall. once you know a language, the language itself can work to offload mental overhead. programming languages are, really, just stacks of mental offloads. who wants to write a highly available checkout system in assembly? not i: at the end of the day, i am still really responsible for the code.

## on plangs

but riley, go and rust and java already exist, why not use them, why a new language? well - fair question. it didn't start here.

if you've managed to not get lost in the sauce/gripped by psychosis, managing a codebase with the agents for the past few years has been varying degrees of an act of architectural policing. we work to establish and agree upon the architecture with the agent, we specify the bejeebeez out of it, and then we let the agents code it up. if you're not just vibing, you're reading the code that gets written, and thinking about it from that architectural perspective - is it still cohesive? are we reintroducing solved concepts? are we violating some unspoken rule? it's all in our heads, and we know what we're doing.

we know what we're doing. we could code it all up by hand, if we wanted to. many of us still want to, and many of us have already coded it up by hand. we've been coding it up by hand for years! we know that when you really kinda squint your eyes at things, all programming languages do the same things. when you've really stopped worrying about the details, all applications have roughly the same shape. only so many process models exist. systems, distributed at any scale, have the same problems, and the solutions have the same shapes. all of this was true before the language models, and so it remains.

so it remains, good software is good software. what's new is that it's faster/easier to write many tests that assert that the software is good, than it is to inspect the software and to understand that it is good. my experience with the agents is that we speedrun closing the distance between current state, new requirements, and the ideal good software state. our tools matter, our environment matters, our infrastructure matters, and of course, our language matters. in any language, the codebase growth path for building with agents (and arguably before) is to have a core harness that codifies an architecture, and then police that the rest of the code changes are either in line with said law, or that the law is kept up to date as needs change. (most abstract app shape is N>=1 sources, N>=1 handlers, N>=1 sinks).

that's kinda how this started. i set out to build a language that had all of the things that i personally wanted in a language (no borrow checker, no garbage collector, easy to think about, easy to code, blah blah blah), that actually _restricted_ the code that could be written, so that it was always good. how the language does that, and where that idea comes from, is a different story, but the language represents the solution as the locus - a singular opinionated way to define a node in an opinionated hypergraph. once that was in place, several unexpected things emerged naturally, and i'm excited to try to share that with you now.

## situated computing

c style programming languages all kinda do the same thing. they have some opinion about what the hardware they're running on is capable of doing, often on a per-operation basis, and they expose those operations in the language. in addition to individual operations, they provide abstractions that group operations into more manageable mental models. ruby's dynamic "everything is an object" approach, for example, collapses the ideas of data layout, memory addresses, garbage collection, behavior inheritance, and a few other things, all into one single idea, a single self-interacting shape that is easier to keep in our minds. here we have classes, modules, mixins, macros, and more. all mental models are available to be expressed in these languages. not all mental models are good. features like garbage collectors, lifetimes, function coloring, etc, all end up being emergent and a bit homogeneous in mainstream languages, as they all seek to be the express-anything general purpose language.

hale does not have this goal of globally anything-expressible. instead, hale seeks to be the express-anything as a unit of situated computation language. hale draws a hard line. a `type` is shape. a `locus` is flow. if it has a lifetime, owns state, or participates in the motion of the program, it's a locus. if it's just data, it's a type. hale is not an express-anything programming language. hale is a general purpose language with a single programming model. by structurally modeling asynchronous messaging channels directly in the language, the cut between domain modeling and technical implementation is completely clean, and can be completely reasoned about.

so what's a locus? a locus is the one thing you get to define for anything that lives. it owns some state, it has some handlers, and it talks to other loci over typed topics declared on its bus. that's it. it owns its children and can call them, but it can't reach sideways: there's no such thing as a reference to a locus you don't own. if you want to talk to anything else, you publish a message to a topic you're allowed to publish, and whoever's listening on the other end gets it. sources, handlers, sinks - remember that app shape from earlier? a locus is that shape, one node at a time, and the topics are the edges. a program is just loci wired together, and the wiring is a thing the compiler can see.

the language underneath that paragraph is almost disappointingly literal:

```hale
type Order { id: String; amount: Decimal; }

topic OrderPlaced  { payload: Order; }
topic OrderShipped { payload: Order; }

locus Warehouse {
    bus {
        subscribe OrderPlaced as on_order;
        publish OrderShipped;
    }

    fn on_order(order: Order) {
        OrderShipped <- order;
    }
}
```

the `bus` block isn't a comment about the architecture. it is the architecture, in the language. remove `publish OrderShipped;` and the last line doesn't become a code review comment. it stops being a program.

that last part is the part i didn't plan for.

## the unexpected things

the first thing that happened is that all of the good software stuff collapsed. SOLID, DRY, CQRS, law of demeter, ports and adapters, yada yada yada. if you actually look at what you enforce in code review, every single one of them is one of two rules: every piece of state has one owner, and things talk over explicit channels instead of reaching into each other. that's the whole list. in go/rust/java/whatever, the language doesn't have a word for either one, so you rebuild them by hand out of classes and interfaces and DI containers and queues, and then you spend half of review checking that you rebuilt them right. in hale the owner is the locus and the channel is the topic, and there's nothing left to memorize, because there's nothing else you can write.

the second thing is that once the wiring is in the language, the compiler can walk it. who publishes on this topic, who subscribes, does the payload on one end match the other end, does this thing self-dispatch forever, does this handler ever actually get to run. `hale topology graph` will draw that graph out of the build, too. not the diagram in the wiki that was last touched three reorganizations ago; the graph the compiler actually used, including the holes where it stopped knowing. those are the review comments i was writing by hand for years (and then writing to the agents, over and over and over). now they're a red build. importantly - when the compiler _can't_ see (a call through a function pointer, say), it says so, as its own distinct answer, instead of pretending the edge isn't there. "i couldn't tell" and "no" are different answers and they need different fixes.

once the compiler can walk the graph, you can do something a little obscene with it: you can make the application state its own law. hale calls each named sentence a claim. a constitution is a set of claims written once, then proved independently by every application and environment that adopts it.

```hale
group ingress = { Api };
group risk_gate = { Risk };
group ledger = { Ledger };

constitution Company {
    no_risk_bypass:
        forbid reaches(ingress, ledger) avoiding risk_gate;

    one_settlement_writer:
        count publishers(topic Settled) == 1;
}

main locus Production {
    params {
        api: Api = Api { };
        risk: Risk = Risk { };
        ledger: Ledger = Ledger { };
    }

    claims { adopt Company; }
}
```

read it literally. there may be a path from the api to the ledger, but there may not be one that avoids risk. exactly one locus may publish `Settled`. these are not tests of a few paths somebody remembered to exercise; they are sentences over the closed call-and-message graph, and they lower to nothing at runtime. make one false and the compiler prints the bypass or the competing writers.

the api, worker, admin tool, development build, production build, whatever, can all adopt the same constitution and prove it against the world each one actually assembles. environments can add law. they cannot inherit `Company` and quietly decide that one settlement writer now means three. if the company decides it wants three settlement writers, fine. change the constitution. now the pull request literally says that the company would like three things to be able to settle money.

the company already has a constitution, of course. it is just currently smeared across security controls, architecture decks, data-governance policy, compliance evidence, and the memory of whoever has been there the longest. calling it a constitution is not the interesting part. making every version of the system prove it is.

the point is not that the agent can't change the law. the point is that it can't change the law by accident, twelve calls and two topics away.

the third thing, and the one that actually made me want to write all of this down, is what it did to working with the agents. go back to the intro: a language constrains the next word. that was always true for us, and it turns out it's just as true for the models. when the only thing you can write is a locus, and the only way a locus can talk is over a topic declared on its bus, the agent doesn't have to be reminded of the architecture, because the architecture is the only sentence the language will accept. the policing moved out of my head and into the build. i still read the code, but i'm reading it for _is this the right shape for the problem_, not _did it sneak a database call into the tax service again_. that second question is just gone. (the toolchain talks to the models directly too - there's an mcp server in the box, and the docs ship as context - but that's plumbing. the interesting part is the language doing the constraining.)

## same shape, every scale

the last thing is more of a feeling than a feature. once you know what there is to know at the hardware level, your existence is just bridging two versions of truth - domain and mechanical. the language has an architectural linker, `main locus`. `placement` says where each locus runs; `bindings` says what each topic travels over. the loci say what the system is. main says how this version of it exists. distributed systems are distributed systems everywhere; the problems of global-scale cloud infra are the same problems at the level of per-core caches on a die. a locus is a locus whether its topic lowers to a direct call in the same thread (the compiler checks the boundary and then erases it - no vtable, no allocation, it's just a call), or a queue across a process, or a wire across an ocean. `OrderShipped <- order;` is still `OrderShipped <- order;`. the program doesn't change shape when you move it. you drew the seam once, in the domain, and the mechanical version falls out.

the same shape keeps going past the binary. each application can emit the topology it proved, a fleet plan names the actual instances and routes that production runs, and hale checks law over that arrangement too. the api can be right. the ledger can be right. prod can still be wrong, because somebody wired a route around risk after both of them were compiled. one binary can be innocent while the fleet is guilty.

## what it's not

it's not magic and it's not going to make your design good. one owner and explicit channels is the _form_ of good software, not the substance. you can absolutely build a beautifully locus-shaped catastrophe with every seam in the wrong place. picking where the seams go is still the whole job, and no language is going to do that for you. also, please don't take "everything is a locus" the way everyone took SOLID and shatter a 200-line script into forty of them with a bus between each. a script is one locus. you add a second one when there's a real seam, and not before.

it really is a script. the top of a hale file reads like something you'd write in python, and the bottom of the same file reads like a systems program, and there's no toolchain switch in between. you turn the strictness up when the problem asks for it, not when the language does.

we've somehow built a software ecosystem where the models can write the code, the codebase can grow faster than anyone can understand it, and the architecture lives half in docs, half in tests, half in prompts, half in the one engineer everyone keeps pinging. yes, that is too many halves. the agents are rediscovering abstractions that already exist, the humans are reviewing code they didn't write, CI is being asked whether the vibes are still structurally sound, and production, as usual, gets the final vote.

this is all going great.

[welcome to hale.](https://hale-lang.org)
