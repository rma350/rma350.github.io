---
layout: post
title: "MIT IAP Software Tools for Operations Research 2013: Integer Programming Callbacks"
date: 2013-02-13 14:36:00
---

The Operations Research Center offered a new course this IAP, 15.S60 SSIM: Software Tools for Operations Research. The course consisted of the following modules (as summarized by Iain Dunning [here](http://iaindunning.com/2013/mit-iap-2013.html)):

* introductory and advanced classes on R
    ([Allison O’Hair](http://web.mit.edu/akohair/www/index.html),
    [Andre Calmon](http://www.mit.edu/~acalmon/),
    [John Silberholz](http://josilber.scripts.mit.edu/)),
* data visualization
    ([Virot Chiraphadhanakul](http://ta.virot.me/)),
* using Python for mathematical modelling
    ([Iain Dunning](http://iaindunning.com/)),
* convex optimization
    ([Vishal Gupta](http://www-bcf.usc.edu/~guptavis/)),
* distributed computing for optimization
    ([John Silberholz](http://josilber.scripts.mit.edu/)),
* customizing integer programming solvers with callbacks (me).

The tutorial I gave has [a self contained wiki that is available to the public here](https://wikis.mit.edu/confluence/display/15DOTs60ia13/Tutorial).  Briefly, the tutorial covered the following topics for MIP:

* Good [object oriented design](https://wikis.mit.edu/confluence/display/15DOTs60ia13/Java+Style+for+CPLEX) for integer programming
* Separation over exponentially many constraints with
    [User Cuts](https://wikis.mit.edu/confluence/display/15DOTs60ia13/Polynomial+Time+Separation+and+UserCutCallback)
    ([UserCutCallback](http://www-01.ibm.com/support/knowledgecenter/SSSA5P_12.5.1/ilog.odms.cplex.help/refjavacplex/html/ilog/cplex/IloCplex.UserCutCallback.html))
  and
    [Lazy Constraints](https://wikis.mit.edu/confluence/display/15DOTs60ia13/A+First+Solution+by+LazyConstraintCallback)
    ([LazyConstraintCallback](http://www-01.ibm.com/support/knowledgecenter/SSSA5P_12.5.1/ilog.odms.cplex.help/refjavacplex/html/ilog/cplex/IloCplex.LazyConstraintCallback.html))
* Giving CPLEX a
    [starting solution](https://wikis.mit.edu/confluence/display/15DOTs60ia13/Advanced+MIP+Start+and+Christofides+Approximation)
    ([addMIPStart](http://www-01.ibm.com/support/knowledgecenter/SSSA5P_12.5.1/ilog.odms.cplex.help/CPLEX/UsrMan/topics/discr_optim/mip/para/49_mipStarts.html))
* Generating integer solutions during branch and bound with a
    [construction heuristic](https://wikis.mit.edu/confluence/display/15DOTs60ia13/Generating+Integer+Solutions+and+HeuristicCallback)
    ([HeuristicCallback](http://www-01.ibm.com/support/knowledgecenter/SSSA5P_12.2.0/ilog.odms.ide.help/html/refjavaopl/html/ilog/cplex/IloCplex.HeuristicCallback.html))
* Improving integer solutions found by CPLEX during branch and bound with an
    [improvement heuristic](https://wikis.mit.edu/confluence/display/15DOTs60ia13/Integrating+Two-Opt+with+Incumbent+Callback)
    ([IncumbentCallback](http://www-01.ibm.com/support/knowledgecenter/SSSA5P_12.5.1/ilog.odms.cplex.help/refjavacplex/html/ilog/cplex/IloCplex.IncumbentCallback.html)
    with
    [HeuristicCallback](http://www-01.ibm.com/support/knowledgecenter/SSSA5P_12.2.0/ilog.odms.ide.help/html/refjavaopl/html/ilog/cplex/IloCplex.HeuristicCallback.html))
* [Profiling](https://wikis.mit.edu/confluence/display/15DOTs60ia13/Profiling+and+Optimizing+User+Cuts)
  and
    [testing](https://wikis.mit.edu/confluence/display/15DOTs60ia13/Adding+Variables+Objectives+and+Constraints#AddingVariablesObjectivesandConstraints-TestYourCode)
  for IP solvers

The traveling salesmen problem is used as a running example.  The implementation uses the Java interface to CPLEX.