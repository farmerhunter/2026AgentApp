import { useEffect, useState } from "react";

export default function useAsyncData(loadData, dependencies = []) {
  const [state, setState] = useState({
    data: null,
    error: null,
    isLoading: true,
  });

  useEffect(() => {
    let isActive = true;

    setState((current) => ({
      data: current.data,
      error: null,
      isLoading: true,
    }));

    loadData()
      .then((data) => {
        if (isActive) {
          setState({ data, error: null, isLoading: false });
        }
      })
      .catch((error) => {
        if (isActive) {
          setState({ data: null, error, isLoading: false });
        }
      });

    return () => {
      isActive = false;
    };
  }, dependencies);

  return state;
}
