---
layout: post
title: "From Separation to Optimization in CPLEX: Using User Cut Callbacks and Lazy Constraint Callbacks to Solve Large TSPs in Java"
date: 2012-06-16 21:08:00
updated: 2013-02-13
---

Update (February 2, 2013): some of the material here has been superceded by [a more recent post]({% post_url 2013-02-13-mit-iap-software-tools-for-operations-research-integer-programming-callbacks %}) based on the tutorial I gave for the 2013 MIT IAP.  However, that tutorial does not discuss multi-threading or the Karger Stein algorithm, which are covered below.

# Introduction

For many important problems in combinatorial optimization, known efficient algorithms (and approximation algorithms) rely on a _separation oracle_ to dynamically generate violated constraints from an exponentially large pool of constraints that describe the problem. To prove that these algorithms run in polynomial time, the ellipsoid method and other theoretically efficient but impractical tools are often used. In practice however, dynamic constraint generation has been incorporated into simplex based integer programming algorithms successfully for many problems.

One such problem is the famous [traveling salesman problem (TSP)](http://en.wikipedia.org/wiki/Travelling_salesman_problem), one of the must well studied problems in combinatorial optimization. The problem is as follows: given a set of cities, or vertices \\(V\\) a set of direct routes between cities, or edges \\(E\\), and for each edge \\(e \in E\\) a distance \\(d_e\\), what is the shortest tour through all the cities that visits each city exactly once? As this problem is quite difficult, we often consider the special case where \\(d_e\\) is assumed to be  [metric](href="http://en.wikipedia.org/wiki/Metric_(mathematics)), the [metric TSP](http://en.wikipedia.org/wiki/Travelling_salesman_problem#Metric_TSP).

The most powerful metric TSP solver is [Concorde](http://www.tsp.gatech.edu/concorde.html), which has been used to solve instances with as many as 15,000 cities exactly.  Concorde uses linear programming and integer programming techniques, and can be configured to use multiple linear programming solvers. One such solver is CPLEX, one of the fastest and most reliable solvers for both linear and integer programming.  However, concorde only uses CPLEX for linear programming and then runs its own custom algorithms to produce integer solutions.

With the release of CPLEX 12.3, a new API for dynamic constraint generation was created: Lazy Constraint Callbacks and User Cut Callbacks.  In this article, we show how to use build a TSP solver entirely within CPLEX using these new dynamic constraint generation features.  As general purpose integer programming solvers such as CPLEX continue to improve over time, a TSP solver that relies on a general purpose IP solver may one day surpass Concorde and other specialized tools.  However, as Concorde uses heuristics which are very effective for TSP, these heuristics would need to be integrated with CPLEX for CPLEX to be competitive.


# Integer Programming Formulations of the TSP

The TSP has several integer programming formulations.  We will describe two, the "subtour elimination" formulation and the "cut set" formulation.  In both formulations, for every edge \\(e \in E\\), there is a binary decision variable \\(x_e\\) that indicates where or not edge \\(e\\) is included in the tour.  For each node \\(v\\), we let \\(\delta(v)\\) be the set of edges incident to node \\(v\\).  For \\(S \subset V\\), we let \\(E(S)\\) be the set of edges with both endpoints in \\(S\\). The subtour elimination formulation is given by

$$
\begin{align}
  &\min &\sum_{e \in E} d_e y_e&\\
  &\text{subject to} &\sum_{e \in \delta(v)} y_e &= 2 &\forall v &\in V,\\
  &&\sum_{e \in E(S)} y_e &\leq |S|-1 &\forall S &\subset V, \, S \neq V,\, S\neq 0,\\
  &&y_e &\in \{0,1\} &\forall e &\in E.\\
\end{align}
$$

Let \\(\delta(S)\\) for all \\(S \subset V\\) be the set of edges with one endpoint in \\(S\\) and the other in \\(V \setminus S\\).  In this notation, the cutset formulation is given by

$$
\begin{align}
&\min &\sum_{e \in E} d_e y_e& \\
&\text{subject to} &\sum_{e \in \delta(v)} y_e &= 2 &\forall v &\in V,\\
&& \sum_{e \in \delta(S)} y_e &\geq 2 &\forall S &\subset V, \, S \neq V,\, S\neq 0,\\
&& y_e &\in \{0,1\} &\forall e &\in E.\\
\end{align}
$$




The two formulations are of equivalent strength, in that LP relaxations for both programs give the same polyhedron.  The solution to the linear programming relaxation is known as the Held-Karp lower bound.  In practice, the optimal solution tends to be within a few percentage points of this lower bound.  Thus solving the LP relaxation and then doing a little branch and bound is generally a good technique for proving optimality of a solution.  However, as the LP relaxations have exponentially many constraints, we need to do dynamic constraint generation.

# Implementation in CPLEX

Here we show a few CPLEX based implementations of a TSP solver using dynamic constraint generation. CPLEX gives two options for generating constraints:

* After every fractional solution is generated, we can have a [UserCutCallback](http://pic.dhe.ibm.com/infocenter/cosinfoc/v12r4/index.jsp?topic=%2Filog.odms.cplex.help%2Frefjavacplex%2Fhtml%2Filog%2Fcplex%2FIloCplex.UserCutCallback.html) that allows us to search for constraints violated by the fractional solution.
* After every integer solution is generated, we can have a [LazyConstraintCallback](LazyConstraintCallback" href="http://pic.dhe.ibm.com/infocenter/cosinfoc/v12r4/index.jsp?topic=%2Filog.odms.cplex.help%2Frefjavacplex%2Fhtml%2Filog%2Fcplex%2FIloCplex.UserCutCallback.html) that allows us to search for constraints violated by the integer solution.


In the case of TSP, the second search problem (identifying constraints violated by an integer solution) is much easier than the first.  When all the edge variables are integer and the degree constraints are satisfied, the edge variables will just be set of loops.  Thus we can determine in \\(O(\|E\|)\\) time which subtour elimination or cutset constraints to add.  However, when the edge variables are still fractional, we can only conveniently separate over the cutset constraints, and to do so we need to solve a [minimum cut problem](http://en.wikipedia.org/wiki/Minimum_cut) on the original graph but with edge weights as the value of the edge variable from the LP relaxation.  The problem can be solved with high probability in \\(O(\|V\|^2 \log^3(\|V\|))\\) with the [Karger Stein Algorithm](http://en.wikipedia.org/wiki/Karger's_randomize_min-cut_algorithm), significantly slower than the \\(O(\|E\|)\\) time when all edge variables were integer.  In practice, however, we find that using a combination of these two approaches is much faster than only separating integer solutions.


We take three approaches.  First, we give a minimal solution that uses only LazyConstraintCallback.  Then, we discuss some engineering and design issues with our first approach and show how to use the [Guava](http://code.google.com/p/guava-libraries/) libraries to make our code more reliable.  Finally, we give a well engineered implementation using both UserCutCallbacks and LazyConstraintCallbacks.  In each approach, we assume our input is given to us as an [UndirectedGraph](http://jung.sourceforge.net/doc/api/edu/uci/ics/jung/graph/UndirectedGraph.html) from the [JUNG](http://jung.sourceforge.net/) library and edge weights.

## A minimal implementation using LazyConstraintCallback

First, we give the implementation, then we discuss some issues.

{% highlight java %}
public class SloppyTsp {

  private static double tolerance = .00001;
  private UndirectedGraph graph;
  private IloCplex cplex;
  private IloIntVar[] edgeVars;
  private Map edgeIndex;
  private List edges;
  private Map vertexIndex;
  private List vertices;
  private LoopExtractor loopExtractor;

  public SloppyTsp(UndirectedGraph graph) throws IloException {
    super();
    this.graph = graph;
    this.cplex = new IloCplex();
    this.loopExtractor = LoopExtractorImpl.instance;
    this.edgeVars = cplex.boolVarArray(graph.getEdgeCount());
    this.edgeIndex = new HashMap();
    this.edges = new ArrayList(graph.getEdges());
    this.vertexIndex = new HashMap();
    this.vertices = new ArrayList(graph.getVertices());
    IloLinearIntExpr[] degreeConstraints =
        new IloLinearIntExpr[vertices.size()];
    int v = 0;
    for(V vertex: vertices){
      degreeConstraints[v] = cplex.linearIntExpr();
      vertexIndex.put(vertex, v++);
    }
    int e =0;
    for(E edge: edges){
      edgeIndex.put(edge, e++);
      IloIntVar edgeVar = edgeVars[edgeIndex.get(edge)];
      for(V vertex :graph.getEndpoints(edge)){
        degreeConstraints[vertexIndex.get(vertex)].addTerm(edgeVar, 1);
      }
    }
    for(int u = 0; u< vertices.size(); u++){
      cplex.addEq(degreeConstraints[u], 2);
    }
    cplex.use(new SubtourElimination());
  }

  public void solve() throws IloException {
    this.cplex.solve();
  }

  public List getTour() throws IloException{
    Set selected = new HashSet();
    double[] ipSolution = cplex.getValues(this.edgeVars);
    for(int e = 0; e< ipSolution.length; e++){
      if(Math.abs(ipSolution[e]-1) < tolerance){
        selected.add(edges.get(e));
      }
    }
    List tours = loopExtractor.subTours(graph, selected);
    if(tours.size() != 1){
      throw new RuntimeException();
    }
    return tours.get(0);
  }

  private class SubtourElimination extends IloCplex.LazyConstraintCallback{

    @Override
    protected void main() throws IloException {
      Set edgesUsed = new HashSet();
      double[] values = this.getValues(edgeVars);
      for(int e = 0; e < edges.size(); e++){
        if(Math.abs(values[e]-1)< tolerance){
          edgesUsed.add(edges.get(e));
        }
      }
      List tours = loopExtractor.subTours(graph, edgesUsed);
      if(tours.size() != 1){
        for(List subtour: tours){
          IloLinearIntExpr subtourVars = cplex.linearIntExpr();
          for(E edge: subtour){
            subtourVars.addTerm(edgeVars[edgeIndex.get(edge)], 1);
          }
          this.add(cplex.le(subtourVars, subtour.size()-1));
        }
      }
    }
  }
}
public interface LoopExtractor {

  public List subTours(UndirectedGraph graph, Set edgesSelected);

}
{% endhighlight %}

The implementation of the `LoopExtractor` is not important to the discussion, but is available in the zip file. We see that with not very much code, it is possible to do dynamic constraint generation. However, this implementation could be greatly improved from an engineering perspective. In particular:

* We create a map between the edges of the graph and an index, and a second map (in the form of an array) from our index to the edge variables (and similarly with the vertices and constraints).  Storing variables in a large array actually seems to be somewhat typical in the examples that come with CPLEX.  However, we really just need a map between the edges of the graph and variables, the index is somewhat irrelevant.  Further, the indices increase the chance of making a coding error, particularly when you have multidimensional arrays of variables.
* We have no way of unit testing individual components of the IP.
* We cannot reuse any of this code to solve related problems.  For example, if we wanted to solve a multistage problem where in each time step, you solved a TSP, and there were some additional linking constraints to relate the problems between time steps, we would have to start from scratch.  Fundamentally, this problem and our previous problem are quite similar: our code is not modular.


These problems are pervasive in the sample Java code that is distributed with CPLEX.  In the next section, we address these issues with a slightly more complicated implementation.

## An improved implementation of the LazyConstraintCallback solution

First, we get rid of the variable indices.  To do this, one might be tempted to make a `HashMap` from the edges to the variables and a second `HashMap` from the variables to the edges, which would give us \\(O(1)\\) lookup time in both directions.  However, there is a better way: [BiMap](http://docs.guava-libraries.googlecode.com/git/javadoc/com/google/common/collect/BiMap.html) from the Guava library.  Additionally, we will make a new class, `EdgeVariables`, to hold the `BiMap`.  The purpose is two-fold.  First, there are many other problems will modeled by integer and linear programs where you input a graph and want to create an edge for every variable, such as maximum weight matching.  We can reuse our `EdgeVariables` class when solving these problems.  Second is type safety.  Suppose we want to write a function that takes in our edge variables and generates the degree constraints.  If the function takes in a `BiMap` of edges and variables, if we had created another such map, we could pass in the wrong map.  One might be concerned about the memory overhead and time wasted by creating all of these extra `HashMap`s, as they are not strictly necessary.  However, at least in Java, the time and memory spent building these slightly heavier data structures (as compared to arrays) is inconsequential given that we are about to solve an integer program over these variables.  The code to create the `BiMap` is below:

{% highlight java %}
public class CplexUtil {
  public static  ImmutableBiMap makeBinaryVariables(IloCplex cplex,
      Iterable set) throws IloException{
    Builder ans = ImmutableBiMap.builder();
    for(T t: set){
      ans.put(t, cplex.boolVar());
    }
    return ans.build();
  }

  ...
}
public class EdgeVariables {

  private ImmutableBiMap edgeVars;

  public EdgeVariables(UndirectedGraph graph,
      IloCplex cplex) throws IloException{
    edgeVars = CplexUtil.makeBinaryVariables(cplex,
        graph.getEdges());
  }

  public ImmutableBiMap getEdgeVars() {
    return edgeVars;
  }
}
{% endhighlight %}

Notice that we actually create an [ImmutableBiMap](http://docs.guava-libraries.googlecode.com/git/javadoc/com/google/common/collect/ImmutableBiMap.html), [a general good practice](http://books.google.com/books?id=ka2VUBqHiWkC&amp;lpg=PA76&amp;ots=yYFoQmv3UY&amp;dq=effective%20java%20immutable&amp;pg=PA73#v=onepage&amp;q&amp;f=false), as we don't want to accidentally modify our edge variable mapping later. Next, we create the degree constraints. We use a similar technique.

{% highlight java %}
public class CplexUtil {
  ...
  public static <T> ImmutableBiMap<T,IloLinearIntExpr> makeLinearIntExpr(
      IloCplex cplex, Iterable<T> set) throws IloException{
    Builder<T,IloLinearIntExpr> ans = ImmutableBiMap.builder();
    for(T t: set){
      ans.put(t, cplex.linearIntExpr());
    }
    return ans.build();
  }
  ...
}

public class DegreeConstraints<V,E> {

  private EdgeVariables<V,E> edgeVariables;
  private UndirectedGraph<V,E> graph;
  private IloCplex cplex;
  private ImmutableBiMap<V,IloLinearIntExpr> degree;
  private ImmutableBiMap<V,IloRange> degreeConstraint;
  private int degreeEquals;

  public DegreeConstraints(EdgeVariables<V, E> edgeVariables,
      UndirectedGraph<V, E> graph, IloCplex cplex,
      int degreeEquals) throws IloException {
    super();
    this.edgeVariables = edgeVariables;
    this.graph = graph;
    this.cplex = cplex;
    this.degreeEquals = degreeEquals;
    degree = CplexUtil.makeLinearIntExpr(cplex, graph.getVertices());
    for(E edge: graph.getEdges()){
      Pair<V> endpoints = graph.getEndpoints(edge);
      for(V vertex: endpoints){
        degree.get(vertex).addTerm(edgeVariables.getEdgeVars().get(edge), 1);
      }
    }
    Builder<V,IloRange> builder = ImmutableBiMap.builder();
    for(V vertex: degree.keySet()){
      builder.put(vertex, cplex.addEq(degree.get(vertex), degreeEquals));
    }
    degreeConstraint = builder.build();
  }

  public DegreeConstraints(UndirectedGraph<V, E> graph, IloCplex cplex,
      int degreeEquals) throws IloException  {
    this(new EdgeVariables<V,E>(graph,cplex),graph,cplex,degreeEquals);
  }

}
{% endhighlight %}

We also create a new class for the subtour elimination callback using the `EdgeVariables` class.

{% highlight java %}
public class LazySubtourElimination<V,E> {

  private UndirectedGraph<V,E> graph;
  private IloCplex cplex;
  private EdgeVariables<V,E> edgeVariables;
  private boolean printOutput;
  private SubtourEliminationCallback callback;

  public LazySubtourElimination(UndirectedGraph<V, E> graph, IloCplex cplex,
                               EdgeVariables<V,E> edgeVariables,
                               boolean printOutput) throws IloException {
    super();
    this.graph = graph;
    this.cplex = cplex;
    this.edgeVariables = edgeVariables;
    this.callback = new SubtourEliminationCallback();
    cplex.use(callback);
  }

  public class SubtourEliminationCallback extends
      IloCplex.LazyConstraintCallback {
    @Override
    protected void main() throws IloException {
      Set<E> edgesUsed = new HashSet<E>();
      IloIntVar[] edgeVars = edgeVariables.getEdgeVars().values()
                                          .toArray(new IloIntVar[]{});
      double[] values = this.getValues(edgeVars);
      for(int i = 0; i < edgeVars.length; i++){
        if(CplexUtil.doubleToBoolean(values[i])){
          edgesUsed.add(edgeVariables.getEdgeVars()
                                     .inverse().get(edgeVars[i]));
        }
      }
      List<List<E>> loops = LoopExtractorImpl.instance
                                             .subTours(graph,edgesUsed);
      if(loops.size()>1){
        for(List<E> loop: loops){
          IloLinearIntExpr loopVars = cplex.linearIntExpr();
          for(E e: loop){
            loopVars.addTerm(edgeVariables.getEdgeVars().get(e), 1);
          }
          this.add(cplex.le(loopVars, loop.size()-1));
        }
        print("Added " + loops.size() + " lazy constraints");
      }
    }
  }

  private void print(String s){
    if(this.printOutput){
      System.out.println(s);
    }
  }
}
{% endhighlight %}

Note that we must resort to using arrays to extract the value of variables as `LazyConstraintCallback.getValues()` method is much faster than calling `LazyConstraintCallback.getValue()` inside a loop. This seems to be a weakness in either the CPLEX library or JNI.  We create a min weight objective class similarly to how we created our constraint classes. Now all that remains is to put all our pieces together. In anticipation of having a second implementation based on the cutset formulation, we first create an abstract class for all TSP solutions based on the `EdgeVariables` class.


{% highlight java %}
public abstract class AbstractTspFormulationEdgeBased<V,E> {

  protected UndirectedGraph<V,E> graph;
  protected Transformer<E,Double> edgeWeights;
  protected EdgeVariables<V,E> edgeVariables;
  protected IloCplex cplex;
  protected DegreeConstraints<V,E> degreeConstraints;
  protected MinEdgeWeightObjective<V,E> objective;
  protected List<E> optimalTour;
  protected double optimalCost;

  protected AbstractTspFormulationEdgeBased(UndirectedGraph<V,E> graph,
      Transformer<E,Double> edgeWeights, IloCplex cplex) throws IloException{
    this.graph = graph;
    this.edgeWeights = edgeWeights;
    this.cplex = cplex;
    this.edgeVariables = new EdgeVariables<V,E>(graph,cplex);
    this.degreeConstraints = new DegreeConstraints<V,E>(edgeVariables,graph,
                                                        cplex,2);
    this.objective = new MinEdgeWeightObjective<V,E>(graph,edgeWeights,
                                                     edgeVariables,cplex);
    cplex.setParam(IloCplex.IntParam.Threads, 4);
  }

  public void solve() throws IloException{
    this.cplex.solve();
    if(cplex.getStatus() == Status.Feasible ||
       cplex.getStatus() == Status.Optimal){
      this.optimalCost = cplex.getObjValue();
      this.optimalTour = extractTour();
    }
    else{
      this.optimalCost = 0;
      this.optimalTour = null;
    }
  }

  public void cleanUp(){
    cplex.end();
  }

  public List<E> getOptimalTour() {
    return optimalTour;
  }

  public double getOptimalCost() {
    return optimalCost;
  }

  protected List<E> extractTour() throws IloException{
    List<List<E>> tours = extractTours();
    if(tours.size() != 1){
      throw new RuntimeException();
    }
    return tours.get(0);
  }

  protected List<List<E>> extractTours() throws IloException{
    Set<E> edgesUsed = new HashSet<E>();
    for(E edge: edgeVariables.getEdgeVars().keySet() ){
      if(CplexUtil.doubleToBoolean(cplex.getValue(edgeVariables.getEdgeVars()
                                                               .get(edge)))){
        edgesUsed.add(edge);
      }
    }
    List<List<E>> tours = LoopExtractorImpl.instance
                                           .subTours(graph, edgesUsed);
    return tours;
  }
}

public class TspSubTourEliminationLazy<V, E> extends
    AbstractTspFormulationEdgeBased<V, E> {

  private LazySubtourElimination<V,E> lazySubtourElimination;

  public TspSubTourEliminationLazy(UndirectedGraph<V, E> graph,
                                   Transformer<E, Double> edgeWeights,
                                   boolean printOutput) throws IloException{
    this(graph,edgeWeights,printOutput,new IloCplex());
  }

  public TspSubTourEliminationLazy(UndirectedGraph<V, E> graph,
      Transformer<E, Double> edgeWeights, boolean printOutput, IloCplex cplex)
      throws IloException {
    super(graph, edgeWeights, cplex);
    this.lazySubtourElimination =
      new LazySubtourElimination<V,E>(graph, cplex,
                                      edgeVariables, printOutput);
  }
}
{% endhighlight %}


Given our new modular design, we could easily reuse our code to solve some kind of multistage optimization problem, and unit testing our code is now possible. For example:

{% highlight java %}
@Test
public void testDegreeConstraints(){
  UndirectedGraph<Node,Node.Edge> graph = Node.makeGraph();
  Transformer<Node.Edge,Double> edgeWeights = Node.makeEdgeWeights();
  try {
    IloCplex cplex = new IloCplex();
    EdgeVariables<Node,Node.Edge> vars =
      new EdgeVariables<Node,Node.Edge>(graph,cplex);
    DegreeConstraints<Node,Node.Edge> degreeConstraints =
      new DegreeConstraints<Node,Node.Edge>(vars,graph,cplex,2);
    MinEdgeWeightObjective<Node, Node.Edge> objective =
      new MinEdgeWeightObjective<Node,Node.Edge>(graph,edgeWeights,
                                                 vars,cplex);
    cplex.solve();
    assertEquals(6,cplex.getObjValue(),tolerance);
    Set<Node.Edge> edgesUsed = new HashSet<Node.Edge>();
    for(Node.Edge edge: vars.getEdgeVars().keySet() ){
      if(CplexUtil.doubleToBoolean(
          cplex.getValue(vars.getEdgeVars().get(edge)))){
        edgesUsed.add(edge);
      }
    }
    List<List<Node.Edge>> tours =
      LoopExtractorImpl.instance.subTours(graph, edgesUsed);
    assertEquals(2,tours.size());
    assertEquals(3,tours.get(0).size());
    assertEquals(3,tours.get(1).size());
    Set<EnumSet<Node.Edge>> toursAsSet = new HashSet<EnumSet<Node.Edge>>();
    for(List<Node.Edge> tour: tours){
      toursAsSet.add(EnumSet.copyOf(tour));
    }
    Set<EnumSet<Node.Edge>> expected = new HashSet<EnumSet<Node.Edge>>();
    expected.add(EnumSet.of(Node.Edge.ab,Node.Edge.bc, Node.Edge.ac));
    expected.add(EnumSet.of(Node.Edge.de,Node.Edge.ef, Node.Edge.df));
    assertEquals(expected,toursAsSet);
    cplex.end();
  } catch (IloException e) {
    throw new RuntimeException(e);
  }
}
{% endhighlight %}

## A fast solution with UserCutCallback and the Karger Stein algorithm for separation

Finally, we give a third implementation based on `UserCutCallback`. Recall that the `UserCutCallback` will allow us to look for and add violated constraints to fractional solutions. Doing so will allow us to solve the LP relaxation before branch and bound begins. Generally the LP relaxation is within a few percentage points of optimal, so there is little work to be done in the branch and bound stage. This greatly improves the performance of the algorithm.

For the TSP, violated constraints can be identified by solving the global min cut problem. We use the randomized Karger Stein algorithm, which will find the minimum cut with high probability. Our algorithm is still guaranteed to be correct, as even when Karger Stein fails by chance, we still have a fall back of our `LazyConstraintCallback` to catch any violated constraints. In fact, you can only use a `UserCutCallback` when the callback does not change the set of feasible integer points, as CPLEX does not guarantee that the `UserCutCallback` will be checked. In particular, if the first LP you solve is integral, the `UserCutCallback` will not be checked. Thus if you are using `UserCutCallbacks` to for dynamic constraint generation, you must also have a `LazyCutCallback` that will check the constraints on integer solutions. The key parts of the implementation are below:

{% highlight java %}
public interface MinCutSolver<V,E> {

  /**
   * @param value the minimum value of a cut to keep
   * @return at least one cut less than value if such a cut exists, otherwise
   *         an empty list.
   */
  public Iterable<Cut<E>> findCutsLessThan(UndirectedGraph<V,E> graph,
      Transformer<E,Number> edgeWeights, double value);
}
public class UserCallbackCutSet<V,E> {

  private UndirectedGraph<V,E> graph;
  private IloCplex cplex;
  private EdgeVariables<V,E> edgeVariables;
  private MinCutSolver<V,E> minCutSolver;
  private double cutVal;
  private boolean haltUser;

  public UserCallbackCutSet(UndirectedGraph<V, E> graph, IloCplex cplex,
      EdgeVariables<V,E> edgeVariables,
      MinCutSolver<V,E> minCutSolver) throws IloException {
    this(graph,cplex,edgeVariables,minCutSolver,2);
  }

  public UserCallbackCutSet(UndirectedGraph<V, E> graph, IloCplex cplex,
      EdgeVariables<V,E> edgeVariables,MinCutSolver<V,E> minCutSolver,
      double cutVal) throws IloException {
    super();
    this.graph = graph;
    this.cplex = cplex;
    this.edgeVariables = edgeVariables;
    this.minCutSolver = minCutSolver;
    this.cutVal = cutVal;
    haltUser = false;
    cplex.use(new CutSetCallback());
  }

  private class CutSetCallback extends IloCplex.UserCutCallback {

    public CutSetCallback(){}

    @Override
    protected void main() throws IloException {
      if(!this.isAfterCutLoop()){
        return;
      }
      if(haltUser){
        return;
      }
      final Map<E,Double> edgeWeights =
        new HashMap<E,Double>(edgeVariables.getEdgeVars().size()*2);
      boolean isIntegral = true;
      IloIntVar[] edgeVars = edgeVariables.getEdgeVars().values()
                                          .toArray(new IloIntVar[]{});
      double[] edgeVarVals = this.getValues(edgeVars);
      for(int i = 0; i < edgeVars.length; i++){
        edgeWeights.put(edgeVariables.getEdgeVars().inverse()
                                                   .get(edgeVars[i]),
                        Double.valueOf(edgeVarVals[i]));
        isIntegral &= CplexUtil.isBinaryIntegral(edgeVarVals[i]);
      }
      if(isIntegral){
        System.err.println("Found integral in user callback");
        return;
      }
      Iterable<Cut<E>> cuts = minCutSolver.findCutsLessThan(graph,
        new Transformer<E,Number>(){
          @Override
          public Number transform(E arg0) {
            return edgeWeights.get(arg0);
          }
        }, 2);
      double bestCut = Double.MAX_VALUE;
      for(Cut<E> graphCutEdges: cuts){
        IloLinearIntExpr cut = cplex.linearIntExpr();
        double cutVal = graphCutEdges.getWeight();
        bestCut = Math.min(bestCut, cutVal);
        for(E edge: graphCutEdges.getEdges()){
          cut.addTerm(edgeVariables.getEdgeVars().get(edge), 1);
        }
        this.add(cplex.ge(cut, 2));
      }
      if(bestCut > cutVal){
        haltUser = true;
        System.out.println("halting user cuts");
      }
    }
  }
}

public class TspUserCutSetIp<V, E> extends
    AbstractTspFormulationEdgeBased<V, E> {

  private MinCutSolver<V,E> minCutSolver;
  private LazySubtourElimination<V,E> lazySubtourElimination;
  private UserCallbackCutSet<V,E> userCallbackCutSet;

  public TspUserCutSetIp(UndirectedGraph<V, E> graph,
      Transformer<E, Double> edgeWeights, MinCutSolver<V,E> minCutSolver,
      double cutVal, boolean printOutput) throws IloException {
    this(graph,edgeWeights,minCutSolver, cutVal,printOutput,new IloCplex());
  }

  public TspUserCutSetIp(UndirectedGraph<V, E> graph,
      Transformer<E, Double> edgeWeights,MinCutSolver<V,E> minCutSolver,
      double cutVal, boolean printOutput,IloCplex cplex) throws IloException {
    super(graph, edgeWeights, cplex);
    cplex.setParam(IloCplex.IntParam.Threads, 8);
    this.minCutSolver = minCutSolver;
    this.lazySubtourElimination =
      new LazySubtourElimination<V,E>(graph,cplex,edgeVariables,printOutput);
    this.userCallbackCutSet =
      new UserCallbackCutSet<V,E>(graph, cplex, edgeVariables,
                                  minCutSolver, cutVal);
  }
}
{% endhighlight %}

Note the somewhat mysterious `UserCutCallback.isAfterCutLoop()` in the `UserCutCallback`. If CPLEX successfully found another kind of cut to add to the problem, this section of code will prevent us from generating constraints and give CPLEX more chances to look for other cuts. In our case, it is a good idea to include this, as often CPLEX will be able to find cuts faster than we can, as solving the minimum global cut problem is difficult.

There are a few optimizations present in the code. First, we do not require that the global min cut problem for identifying violated constraints is solved to optimality, and we allow the global min cut solver to return multiple violated cuts. We then add all these constraints each callback. In fact, our Karger Stein implementation stops immediately when it finds cuts that are "good enough," which greatly speeds up the algorithm. When we have found a solution that nearly satisfies all of the LP constraints, we "halt" the `UserCutCallback` and instead move to branch and bound and rely on the `LazyCutCallback` instead. We do this because when the LP relaxation is nearly satisfied, it takes much longer to find violated constraints (since we cannot terminate early). Also when the LP relaxation is nearly satisfied, we have a very good lower bound, which makes branch and bound very effective.

# Conclusion

We saw that large constraint generation schemes for TSP and similar problems can be easily implemented using `LazyConstraintCallback` and a separation oracle. We briefly discussed basic principles of object oriented design applied to the design and testing of integer programs, using our TSP solver as an example. We integrated well established Java libraries of Guava, JUNG, and CPLEX Concert Technologies to accomplish our task with a small amount of code. Finally, we greatly improved our algorithm's performance by using `UserCutCallback` and a Karger Stein separation oracle in conjunction with our `LazyConstraintCallback`.

At this point, our solver would probably benefit most from some good rounding schemes to generate integer solutions once we have solved the LP relaxation, and good local search heuristics to improve on integer solutions we have already found. CPLEX has additional callbacks for inserting integer solutions. Additionally, a more careful implementation of the Karger Stein algorithm (that ran faster and used less memory) would also likely be of value. It would be interesting to see if such a solver could compete with or surpass Concorde.

_The complete source code from these examples can be downloaded from an [Assembla]("http://www.assembla.com/") subversion repository [here](https://www.assembla.com/code/oocplex/subversion/nodes). There is also a TSPLib parser and the TSPLib sample problems._















