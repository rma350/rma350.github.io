---
layout: post
title:  "All Pairs Shortest Path in Parallel with Floyd Warshal in Java"
date:   2012-06-13 11:54:00
categories: algorithms java
---

The [All Pairs Shortest Path](http://en.wikipedia.org/wiki/Shortest_path_problem#All-pairs_shortest_paths) (APSP) problem is to compute the shortest path between every pair of points in a directed weighted graph.  The [Floyd Warshall algorithm](http://en.wikipedia.org/wiki/Floyd%E2%80%93Warshall_algorithm) is a dynamic programming algorithm that solves the APSP problem in \\(O(V^3)\\) time. The running time is impressive, as there are \\(O(V^2)\\) pairs of nodes, so the average time spent per pair is \\(O(V)\\), faster than solving a standard shortest path problem.

Provided below is a parallel implementation of the algorithm.  There is also a wrapper for the [JUNG](http://jung.sourceforge.net/) library so this code can be used to solve APSP for a JUNG `DirectedGraph`, and JUnit tests, in this [Assembla SVN repository](http://www.assembla.com/code/apsp/subversion/nodes).  On a related note, [JGraphT](http://jgrapht.org/) also [provides an implementation of APSP](http://jgrapht.org/javadoc/org/jgrapht/alg/FloydWarshallShortestPaths.html), but it is not parallel.

Warning: do not forget to shut down your ExecutorService, we don't do it!

Edit: There is an updated version in the Assembla repository that supports both single threaded and multi threaded modes.  Also there is a Demo class to test the performance on large random graphs.  On a graph of 3000 nodes, the single threaded mode took 130 seconds, while the multithreaded mode (on an 8 core machine) took 37 seconds.  The single threaded mode only seems to be faster for graphs with about 100 nodes or fewer, and on these graphs, the running time is about 15 milliseconds.

{% highlight java %}
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;

public class ParallelFloydWarshall {
  
  private ExecutorService exec;
  private int numThreads;
  private double[] current;
  private double[] next;
  
  private int[] maxIndex;
  private int numNodes;
  private boolean solved;
  
  private int getIndex(int i, int j){
    return i*numNodes+j;
  }
  
  private int getI(int index){
    return index / numNodes;
  }
  
  private int getJ(int index){
    return index % numNodes;
  }
  
  /**
   * @param numNodes the number of nodes in the graph
   * @param distances the matrix of distances between nodes, indexed from 0 to
   *                  numNodes-1.  distances[i][j] cost of a directed edge from
   *                  i to j.  Must be Double.POSITIVE_INFINITY if the edge is
   *                  not present.  distance[i][i] is a self arc (allowed).
   */
  public ParallelFloydWarshall(int numNodes, double[][] distances,
                               ExecutorService exec, int numThreads){
    this.exec = exec;
    this.numThreads = numThreads;
    this.numNodes = numNodes;
    this.current = new double[numNodes*numNodes];
    this.next = new double[numNodes*numNodes];
    this.maxIndex = new int[numNodes*numNodes];
    Arrays.fill(maxIndex, -1);
    for(int i = 0; i < numNodes; i++){
      for(int j = 0; j < numNodes; j++){
        current[getIndex(i,j)] = distances[i][j];
      }
    }
    this.solved = false;
  }
  
  public void solve(){
    if(solved){
      throw new RuntimeException("Already solved");
    }
    for(int k = 0; k < numNodes; k++){
      List<Callable<Boolean>> tasks = new ArrayList<Callable<Boolean>>();
      if(current.length < numThreads){
        for(int i = 0; i < current.length; i++){
          tasks.add(new FloydJob(i,i+1,k));
        }
      }
      else{
        for(int t = 0; t < numThreads; t++){
          int lo = t*current.length/numThreads;
          int hi = (t+1)*current.length/numThreads;
          tasks.add(new FloydJob(lo,hi,k));
        }
      }
      try {
        List<Future<Boolean>> results = this.exec.invokeAll(tasks);
        for(Future<Boolean> result : results){
          if(!result.get().booleanValue()){
            throw new RuntimeException();
          }
        }
      } catch (InterruptedException e) {
        throw new RuntimeException(e);
      } catch (ExecutionException e) {
        throw new RuntimeException(e);
      }
      double[] temp = current;
      current = next;
      next = temp;      
    }
    next = null;
    solved = true;
  }
  
  /**
   * 
   * @param i must lie in in [0,numNodes)
   * @param j must lie in in [0,numNodes)
   * @return the length of the shortest directed path from node i to node j.
   *         If i == j, gives the shortest directed cycle starting at node i
   *          (note that the graph may contain nodes with self loops).  Returns
   *         Double.POSITIVE_INFINITY if there is no path from i to j.
   */
  public double shorestPathLength(int i, int j){
    if(!solved){
      throw new RuntimeException("Must solve first");
    }
    return this.current[getIndex(i,j)];
  }
  /**
   * Example: If the path from node 2 to node 5 is an edge from 2 to 3 and then
   * an edge from 3 to 5, the return value will be
   * Arrays.asList(Integer.valueOf(2),Integer.valueOf(3),Integer.valueOf(5));
   * 
   * @param i the start of the directed path
   * @param j the end of the directed path
   * @return The shortest path starting at node i and ending at node j, or null
   *         if no such path exists.
   */
  public List<Integer> shortestPath(int i, int j){    
    if(current[getIndex(i,j)] == Double.POSITIVE_INFINITY){
      return null;
    }
    else{
      List<Integer> ans = new ArrayList<Integer>();      
      ans.add(Integer.valueOf(i));
      shortestPathHelper(i,j,ans);
      return ans;
    }
  }
  
  public void shortestPathHelper(int i, int j, List<Integer> partialPath){
    int index = getIndex(i,j);
    if(this.maxIndex[index] < 0){
      partialPath.add(Integer.valueOf(j));
    }
    else{
      shortestPathHelper(i,this.maxIndex[index],partialPath);
      shortestPathHelper(this.maxIndex[index],j,partialPath);
    }
  }
  
  private class FloydJob implements Callable<Boolean>{
    
    private final int lo;
    private final int hi;
    private final int k;
    
    public FloydJob(int lo, int hi, int k){
      this.lo = lo;
      this.hi = hi;
      this.k = k;
    }

    @Override
    public Boolean call() throws Exception {
      for(int index = lo; index < hi; index++){
        int i = getI(index);
        int j = getJ(index);
        double alternatePathValue = current[getIndex(i,k)]
                                      + current[getIndex(k,j)];
         
        if(alternatePathValue < current[index]){
          next[index] = alternatePathValue;
          maxIndex[index] = k;
        }
        else{
          next[index] = current[index];
        }
      }
      return true;
    }
  }
}
{% endhighlight %}